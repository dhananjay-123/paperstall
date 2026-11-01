"use client";

import type { Receipt } from "@/core/receipts";

export type ApiFailure = { code: string; message: string; debugId?: string; retryAfter?: number };

export class ApiCallError extends Error {
  constructor(readonly status: number, readonly error: ApiFailure, readonly receipts: Receipt[]) {
    super(error.message);
  }
}

type Listener = (r: Receipt[]) => void;
const listeners = new Set<Listener>();

/** The store subscribes here so every API call's receipts reach the Receipts drawer. */
export function onReceipts(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });
  let payload: { data?: T; error?: ApiFailure; receipts?: Receipt[] } = {};
  try {
    payload = await res.json();
  } catch {
    // Non-JSON (e.g. a platform error page) falls through to the generic error below.
  }
  const receipts = payload.receipts ?? [];
  if (receipts.length) for (const fn of listeners) fn(receipts);
  if (!res.ok || payload.error) {
    const retry = Number(res.headers.get("Retry-After") ?? "") || undefined;
    throw new ApiCallError(res.status, payload.error ?? { code: `HTTP_${res.status}`, message: "The server didn't answer properly.", retryAfter: retry }, receipts);
  }
  return payload.data as T;
}
