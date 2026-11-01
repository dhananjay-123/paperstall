import { createHmac, timingSafeEqual } from "node:crypto";
import LZString from "lz-string";
import { StallPayload } from "./stall";

export { peekStall } from "./peek";

// Signatures are HMAC-SHA256 over the exact compressed string, truncated to 128 bits
// (base64url) to keep links and QR codes short.

function mac(secret: string, purpose: string, data: string): string {
  return createHmac("sha256", secret).update(`${purpose}\n${data}`).digest("base64url").slice(0, 22);
}

function same(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const MAX_SIGNED_LENGTH = 6000;

export function signStall(payload: StallPayload, secret: string): string {
  const data = LZString.compressToEncodedURIComponent(JSON.stringify(StallPayload.parse(payload)));
  return `${data}.${mac(secret, "stall", data)}`;
}

export type StallVerdict = { ok: true; payload: StallPayload } | { ok: false; reason: "malformed" | "tampered" | "expired" | "invalid" };

export function verifyStall(signed: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): StallVerdict {
  if (typeof signed !== "string" || signed.length > MAX_SIGNED_LENGTH) return { ok: false, reason: "malformed" };
  const dot = signed.lastIndexOf(".");
  if (dot < 1) return { ok: false, reason: "malformed" };
  const data = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  if (!same(sig, mac(secret, "stall", data))) return { ok: false, reason: "tampered" };
  let raw: unknown;
  try {
    raw = JSON.parse(LZString.decompressFromEncodedURIComponent(data) ?? "");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const parsed = StallPayload.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (parsed.data.x < nowSec) return { ok: false, reason: "expired" };
  return { ok: true, payload: parsed.data };
}

// Receipt QR: orderId + stallId, signed so a seller's scanner can reject forged receipts.
export function signReceipt(orderId: string, stallId: string, secret: string): string {
  const data = `${orderId}~${stallId}`;
  return `ps1~${data}~${mac(secret, "receipt", data)}`;
}

export function verifyReceipt(code: string, secret: string): { ok: true; orderId: string; stallId: string } | { ok: false } {
  const parts = code.trim().split("~");
  if (parts.length !== 4 || parts[0] !== "ps1") return { ok: false };
  const [, orderId, stallId, sig] = parts;
  if (!/^[A-Z0-9]{5,40}$/.test(orderId) || !/^[0-9a-f-]{36}$/.test(stallId)) return { ok: false };
  return same(sig, mac(secret, "receipt", `${orderId}~${stallId}`)) ? { ok: true, orderId, stallId } : { ok: false };
}
