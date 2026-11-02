// The "doorbell": after PayPal confirms a payment, the server posts the order ID to a private
// ntfy.sh topic the seller's counter listens on. It is only a nudge. The counter still checks
// the order with PayPal before showing it, so a forged message can't create a sale.
// Shared by server and client: no secrets here.

export const DOORBELL_BASE = "https://ntfy.sh";

// "paid": the server confirmed a payment. "rec": one of the seller's devices counted it
// (lets a second device refuse a receipt the first already accepted).
export type Bell = { t: "paid" | "rec"; o: string };

export function parseBell(message: unknown): Bell | null {
  if (typeof message !== "string") return null;
  try {
    const b = JSON.parse(message) as Partial<Bell>;
    if ((b.t === "paid" || b.t === "rec") && typeof b.o === "string" && /^[A-Z0-9]{5,40}$/.test(b.o)) return { t: b.t, o: b.o };
  } catch {
    // Someone else's text on the topic: ignore it.
  }
  return null;
}

/** "K7Q4" → "K7 Q4", for reading aloud. */
export const formatPickup = (code: string) => `${code.slice(0, 2)} ${code.slice(2)}`;
