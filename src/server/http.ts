import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { PayPalError } from "@/server/paypal/client";
import type { Receipt } from "@/core/receipts";

export type ApiError = { code: string; message: string; debugId?: string; retryAfter?: number };

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Partial<ApiError> = {},
  ) {
    super(message);
  }
}

export function ok<T>(data: T, receipts: Receipt[] = [], init?: ResponseInit) {
  return NextResponse.json({ data, receipts }, init);
}

export function fail(err: unknown, receipts: Receipt[] = []) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, ...err.extra }, receipts }, {
      status: err.status,
      headers: err.extra.retryAfter ? { "Retry-After": String(err.extra.retryAfter) } : undefined,
    });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input" }, receipts },
      { status: 400 },
    );
  }
  if (err instanceof PayPalError) {
    const status = err.status >= 500 ? 502 : err.status === 401 ? 502 : err.status;
    return NextResponse.json(
      { error: { code: `PAYPAL_${err.issue ?? err.name}`, message: err.message, debugId: err.debugId }, receipts },
      { status },
    );
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  // Env/config errors are safe to show (they name a variable, never a value).
  const isConfig = message.startsWith("Missing required environment variable");
  if (!isConfig) console.error("[api]", err instanceof Error ? err.name : "error");
  return NextResponse.json(
    { error: { code: isConfig ? "NOT_CONFIGURED" : "INTERNAL", message: isConfig ? message : "Something went wrong on our side." }, receipts },
    { status: isConfig ? 503 : 500 },
  );
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T>, maxBytes = 64_000): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "TOO_LARGE", "Request is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "TOO_LARGE", "Request is too large.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
  return schema.parse(raw);
}

/** Mutating routes only accept requests from our own pages. */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server) don't send Origin; CORS still blocks browsers
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new HttpError(403, "CROSS_ORIGIN", "Cross-origin requests are not allowed.");
}

// Best-effort per-IP token bucket. On serverless each instance has its own buckets, so this
// slows abuse rather than guaranteeing a hard limit.
const buckets = new Map<string, { tokens: number; at: number }>();

export function rateLimit(req: NextRequest, key: string, perMinute: number) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(id) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute);
  b.at = now;
  if (b.tokens < 1) {
    const retryAfter = Math.ceil(((1 - b.tokens) / perMinute) * 60);
    buckets.set(id, b);
    throw new HttpError(429, "RATE_LIMITED", "Too many requests. Please wait a moment.", { retryAfter });
  }
  b.tokens -= 1;
  buckets.set(id, b);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.at > 300_000) buckets.delete(k);
}
