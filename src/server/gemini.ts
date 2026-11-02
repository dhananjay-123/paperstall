import "server-only";
import { GoogleGenAI, type Content, type FunctionDeclaration, type GenerateContentConfig } from "@google/genai";
import type { ZodType } from "zod";
import { env, requireEnv } from "@/lib/env";
import type { ReceiptBook } from "@/core/receipts";
import { HttpError } from "@/server/http";

// Chosen with scripts/probe-gemini.ts on 2026-11-02 (vision+JSON+boxes+tools); override in env.
export const DEFAULT_MODEL = "gemini-3-flash-preview";
export const DEFAULT_FAST_MODEL = "gemini-3.5-flash-lite";

let client: GoogleGenAI | null = null;
function ai() {
  client ??= new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  return client;
}

// Used once when the chosen model is overloaded (503) or out of quota (429). It has its own free-tier quota.
export const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash";

export function models() {
  return {
    main: env.GEMINI_MODEL ?? DEFAULT_MODEL,
    fast: env.GEMINI_FAST_MODEL ?? env.GEMINI_MODEL ?? DEFAULT_FAST_MODEL,
    fallback: env.GEMINI_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL,
  };
}

function statusOf(err: unknown): number | undefined {
  if (typeof err === "object" && err && "status" in err && typeof err.status === "number") return err.status;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || /\baborted\b|timed? ?out/i.test(err.message))) return 504;
  const m = err instanceof Error ? /\b(429|500|502|503|504)\b/.exec(err.message) : null;
  return m ? Number(m[1]) : undefined;
}

function retryDelaySeconds(err: unknown): number | undefined {
  const m = err instanceof Error ? /retry in ([\d.]+)s|"retryDelay":\s*"(\d+)s"/i.exec(err.message) : null;
  return m ? Math.ceil(Number(m[1] ?? m[2])) : undefined;
}

/** A free-tier *daily* cap: waiting a minute won't help, so don't count down to a retry. */
export function isDailyQuota(err: unknown): boolean {
  if (statusOf(err) !== 429) return false;
  const msg = err instanceof Error ? err.message : "";
  return /per ?day|PerDay/i.test(msg) || (retryDelaySeconds(err) ?? 0) > 3600;
}

type GenOpts = {
  model?: string;
  contents: Content[];
  config?: GenerateContentConfig;
  receipts?: ReceiptBook;
  note?: string;
  timeoutMs?: number;
  /** Wall-clock deadline (Date.now() ms) shared by retries and the fallback. */
  deadline?: number;
  /** false: no fallback model. */
  fallback?: boolean;
};

class Upstream extends Error {
  constructor(
    readonly model: string,
    readonly err: unknown,
  ) {
    super(err instanceof Error ? err.message : String(err));
  }
  get status() {
    return statusOf(this.err) ?? 0;
  }
}

async function attempt(model: string, opts: GenOpts, tries: number) {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const left = opts.deadline ? opts.deadline - Date.now() : Infinity;
    if (left < 1500) break;
    const started = Date.now();
    try {
      const res = await ai().models.generateContent({
        model,
        contents: opts.contents,
        config: { ...opts.config, abortSignal: AbortSignal.timeout(Math.min(opts.timeoutMs ?? 45_000, left)) },
      });
      opts.receipts?.add({ service: "gemini", method: "POST", path: `models/${model}:generateContent`, status: 200, ok: true, ms: Date.now() - started, note: opts.note });
      return res;
    } catch (err) {
      const status = statusOf(err) ?? 0;
      opts.receipts?.add({ service: "gemini", method: "POST", path: `models/${model}:generateContent`, status, ok: false, ms: Date.now() - started, note: opts.note });
      // The server log is the only place an upstream outage shows up, so say what Gemini answered.
      console.warn(`[gemini] ${model} ${opts.note ?? ""} → ${status || "error"} after ${Date.now() - started}ms: ${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`);
      lastErr = err;
      const wait = retryDelaySeconds(err) ?? 0;
      // Retry only short, transient failures; long quota windows and timeouts go to the fallback or the UI.
      if (!(status === 429 || status >= 500) || status === 504 || isDailyQuota(err) || wait > 8) break;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, wait * 1000 || 800 * 2 ** i));
    }
  }
  throw new Upstream(model, lastErr);
}

/**
 * generateContent with a timeout, a short backoff on 429/5xx, and one fallback model when the
 * chosen one is overloaded or out of quota. Ends in an error the UI can show calmly.
 */
export async function generate(opts: GenOpts) {
  const primary = opts.model ?? models().main;
  const fallback = opts.fallback === false ? undefined : models().fallback;
  const canFallBack = Boolean(fallback && fallback !== primary);
  let first: Upstream;
  try {
    // With a fallback ready, don't spend the time budget retrying an overloaded model.
    return await attempt(primary, opts, canFallBack ? 1 : 3);
  } catch (e) {
    first = e as Upstream;
  }
  const busy = (s: number) => s === 429 || s >= 500;
  let last = first;
  if (canFallBack && busy(first.status)) {
    console.warn(`[gemini] falling back ${primary} → ${fallback}`);
    try {
      return await attempt(fallback!, { ...opts, note: `${opts.note ?? "ai"} (fallback)` }, 2);
    } catch (e) {
      last = e as Upstream;
    }
  }
  if (isDailyQuota(first.err) && (last === first || last.status === 429)) {
    throw new HttpError(429, "AI_DAILY_LIMIT", "Today's free AI reads are used up. Try a cached sample, or come back tomorrow.");
  }
  if (last.status === 429 && !opts.deadline) {
    throw new HttpError(429, "AI_RATE_LIMITED", "The AI is busy. Ink is drying…", { retryAfter: Math.min(90, retryDelaySeconds(last.err) ?? 20) });
  }
  if (busy(last.status)) throw new HttpError(503, "AI_BUSY", "The AI is busy right now. Try again in a minute.");
  throw new HttpError(502, "AI_FAILED", "The AI couldn't answer right now. Please try again.");
}

// Gemini's structured output rejects some JSON Schema keywords (found by bisecting a 400:
// minItems/maxItems, plus $schema, additionalProperties, min/maxLength). zod re-checks all of
// them after the response, so dropping them here loses no validation.
const UNSUPPORTED = new Set(["$schema", "additionalProperties", "maxLength", "minLength", "minItems", "maxItems"]);

export function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (UNSUPPORTED.has(k)) continue;
    out[k] = k === "properties" ? Object.fromEntries(Object.entries(v as object).map(([pk, pv]) => [pk, toGeminiSchema(pv)])) : toGeminiSchema(v);
  }
  return out;
}

/** Structured output, zod-validated, with one repair attempt that shows the model its errors. */
export async function generateJson<T>(opts: GenOpts & { schema: ZodType<T>; jsonSchema: unknown }): Promise<T> {
  const config: GenerateContentConfig = { ...opts.config, responseMimeType: "application/json", responseJsonSchema: toGeminiSchema(opts.jsonSchema) };
  const first = await generate({ ...opts, config });
  const parsed = safeParse(opts.schema, first.text);
  if (parsed.ok) return parsed.value;

  const repair = await generate({
    ...opts,
    note: `${opts.note ?? "json"} (repair)`,
    config,
    contents: [
      ...opts.contents,
      { role: "model", parts: [{ text: first.text ?? "" }] },
      { role: "user", parts: [{ text: `That JSON did not match the schema: ${parsed.error}. Return corrected JSON only.` }] },
    ],
  });
  const second = safeParse(opts.schema, repair.text);
  if (second.ok) return second.value;
  throw new HttpError(502, "AI_BAD_OUTPUT", "The AI's answer didn't make sense. Please try again.");
}

function safeParse<T>(schema: ZodType<T>, text: string | undefined): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const r = schema.safeParse(JSON.parse(text ?? ""));
    if (r.success) return { ok: true, value: r.data };
    return { ok: false, error: r.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  } catch {
    return { ok: false, error: "not valid JSON" };
  }
}

export type { Content, FunctionDeclaration };
