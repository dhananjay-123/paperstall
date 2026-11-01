import "server-only";
import { requireEnv } from "@/lib/env";
import type { ReceiptBook } from "@/core/receipts";

const BASE = "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(
    readonly status: number,
    readonly name: string,
    message: string,
    readonly debugId?: string,
    readonly details?: { issue: string; description?: string; field?: string }[],
  ) {
    super(message);
  }
  /** The most specific thing PayPal told us, for the UI. */
  get issue(): string | undefined {
    return this.details?.[0]?.issue;
  }
}

type Token = { value: string; expiresAt: number };
let token: Token | null = null;
let pending: Promise<Token> | null = null;

async function fetchToken(): Promise<Token> {
  const id = requireEnv("PAYPAL_CLIENT_ID");
  const secret = requireEnv("PAYPAL_CLIENT_SECRET");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new PayPalError(res.status, "AUTH_FAILED", "PayPal rejected the app credentials.", res.headers.get("paypal-debug-id") ?? undefined);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so a token never expires mid-request.
  return { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
}

async function getToken(force = false): Promise<string> {
  if (!force && token && token.expiresAt > Date.now()) return token.value;
  pending ??= fetchToken().finally(() => {
    pending = null;
  });
  token = await pending;
  return token.value;
}

type RequestOptions = {
  body?: unknown;
  /** Idempotency key; generated for every POST when omitted. */
  requestId?: string;
  receipts?: ReceiptBook;
  /** Response handling: JSON (default) or raw text (QR codes). */
  as?: "json" | "text";
  query?: Record<string, string | number | undefined>;
  note?: string;
};

export async function paypal<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, opts: RequestOptions = {}): Promise<T> {
  const requestId = method === "POST" ? (opts.requestId ?? crypto.randomUUID()) : undefined;
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const send = async (bearer: string) =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

  const started = Date.now();
  let res = await send(await getToken());
  // A token can be revoked before its expiry; retry once with a fresh one. Safe because the
  // request id makes a repeated POST idempotent.
  if (res.status === 401) res = await send(await getToken(true));

  const debugId = res.headers.get("paypal-debug-id") ?? undefined;
  opts.receipts?.add({
    service: "paypal",
    method,
    path: url.pathname,
    status: res.status,
    ok: res.ok,
    debugId,
    requestId,
    ms: Date.now() - started,
    note: opts.note,
  });

  if (!res.ok) {
    let body: { name?: string; message?: string; debug_id?: string; details?: { issue: string; description?: string; field?: string }[]; error_description?: string } = {};
    try {
      body = await res.json();
    } catch {
      // Some errors come back without a JSON body.
    }
    throw new PayPalError(
      res.status,
      body.name ?? `HTTP_${res.status}`,
      body.details?.[0]?.description ?? body.message ?? body.error_description ?? `PayPal returned ${res.status}`,
      body.debug_id ?? debugId,
      body.details,
    );
  }
  if (res.status === 204) return undefined as T;
  if (opts.as === "text") return (await res.text()) as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}
