import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { DOORBELL_BASE, type Bell } from "@/core/doorbell";

// The topic is a random secret. It travels inside the public stall link only sealed
// (AES-256-GCM under a key derived from the signing secret), so buyers can't read it and
// re-signing someone else's stall ID can't recover it. Only the seller's device holds it in clear.

const key = (secret: string) => createHash("sha256").update(`doorbell\n${secret}`).digest();

export const newTopic = () => `ps_${randomBytes(18).toString("base64url")}`;

export function sealTopic(topic: string, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([c.update(topic, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

export function openTopic(sealed: string, secret: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// No 0/O, 1/I/L, 2/Z, 5/S, 8/B: easy to read aloud and hard to mishear.
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

/** A 4-character pickup code tied to the order. Shown on the buyer's receipt and on the counter. */
export function pickupCode(orderId: string, secret: string): string {
  const h = createHmac("sha256", secret).update(`pickup\n${orderId}`).digest();
  return Array.from(h.subarray(0, 4), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Best effort: if ntfy is down the seller still has the receipt scan. */
export async function ring(topic: string, bell: Bell): Promise<void> {
  try {
    await fetch(`${DOORBELL_BASE}/${topic}`, { method: "POST", body: JSON.stringify(bell), signal: AbortSignal.timeout(3000) });
  } catch {
    // Swallowed on purpose.
  }
}
