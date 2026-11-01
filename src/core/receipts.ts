// A receipt is one outbound call (PayPal, Gemini, Channel3) made on the seller's behalf.
// The server attaches receipts to API responses; the client stores them for the Receipts drawer.
// No PII: paths only, never bodies.

export type Receipt = {
  id: string;
  at: string; // ISO time
  service: "paypal" | "gemini" | "channel3";
  method: string;
  path: string;
  status: number;
  ok: boolean;
  debugId?: string;
  requestId?: string;
  ms: number;
  /** Who triggered it, e.g. "ui", "penny", "verify". */
  via?: string;
  note?: string;
};

export class ReceiptBook {
  readonly items: Receipt[] = [];
  constructor(readonly via?: string) {}
  add(r: Omit<Receipt, "id" | "at" | "via">) {
    this.items.push({ ...r, id: crypto.randomUUID(), at: new Date().toISOString(), via: this.via });
  }
}
