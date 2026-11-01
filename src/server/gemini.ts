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

export function models() {
  return { main: env.GEMINI_MODEL ?? DEFAULT_MODEL, fast: env.GEMINI_FAST_MODEL ?? env.GEMINI_MODEL ?? DEFAULT_FAST_MODEL };
}

function statusOf(err: unknown): number | undefined {
  if (typeof err === "object" && err && "status" in err && typeof err.status === "number") return err.status;
  const m = err instanceof Error ? /\b(429|500|502|503|504)\b/.exec(err.message) : null;
  return m ? Number(m[1]) : undefined;
}

function retryDelaySeconds(err: unknown): number | undefined {
  const m = err instanceof Error ? /retry in ([\d.]+)s|"retryDelay":\s*"(\d+)s"/i.exec(err.message) : null;
  return m ? Math.ceil(Number(m[1] ?? m[2])) : undefined;
}

type GenOpts = {
  model?: string;
  contents: Content[];
  config?: GenerateContentConfig;
  receipts?: ReceiptBook;
  note?: string;
  timeoutMs?: number;
};

/** generateContent with a timeout and backoff on 429/5xx. Surfaces a RATE_LIMITED error the UI can count down. */
export async function generate(opts: GenOpts) {
  const model = opts.model ?? models().main;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = Date.now();
    try {
      const res = await ai().models.generateContent({
        model,
        contents: opts.contents,
        config: { ...opts.config, abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 45_000) },
      });
      opts.receipts?.add({ service: "gemini", method: "POST", path: `models/${model}:generateContent`, status: 200, ok: true, ms: Date.now() - started, note: opts.note });
      return res;
    } catch (err) {
      const status = statusOf(err) ?? 0;
      opts.receipts?.add({ service: "gemini", method: "POST", path: `models/${model}:generateContent`, status, ok: false, ms: Date.now() - started, note: opts.note });
      lastErr = err;
      const retryable = status === 429 || status >= 500;
      if (!retryable) break;
      const wait = retryDelaySeconds(err);
      // Don't hold a serverless function for a long free-tier quota window: hand it to the UI.
      if (status === 429 && (wait ?? 0) > 8) throw new HttpError(429, "AI_RATE_LIMITED", "The AI is busy. Ink is drying…", { retryAfter: wait });
      if (attempt < 2) await new Promise((r) => setTimeout(r, (wait ? wait * 1000 : 0) || 800 * 2 ** attempt));
    }
  }
  if (statusOf(lastErr) === 429) throw new HttpError(429, "AI_RATE_LIMITED", "The AI is busy. Ink is drying…", { retryAfter: retryDelaySeconds(lastErr) ?? 20 });
  throw new HttpError(502, "AI_FAILED", "The AI couldn't read this right now. Please try again.");
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
