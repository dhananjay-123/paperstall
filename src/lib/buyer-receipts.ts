"use client";

// Receipts live on the buyer's device only. The seller learns about the sale by scanning it.

export type BuyerReceipt = {
  orderId: string;
  captureId: string;
  stallId: string;
  stallName: string;
  totalMinor: number;
  currency: string;
  items: { name: string; quantity: number }[];
  at: string;
  receiptCode: string;
};

const KEY = "paperstall:buyer-receipts:v1";

export function loadBuyerReceipts(): BuyerReceipt[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as BuyerReceipt[];
  } catch {
    return [];
  }
}

export function saveBuyerReceipt(r: BuyerReceipt) {
  try {
    const all = [r, ...loadBuyerReceipts().filter((x) => x.orderId !== r.orderId)].slice(0, 50);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the receipt page still shows from memory this session.
  }
  memory.set(r.orderId, r);
}

const memory = new Map<string, BuyerReceipt>();

/** Returns the same object on every call (useSyncExternalStore needs a stable snapshot). */
export function findBuyerReceipt(orderId: string): BuyerReceipt | undefined {
  const hit = memory.get(orderId);
  if (hit) return hit;
  const stored = loadBuyerReceipts().find((r) => r.orderId === orderId);
  if (stored) memory.set(orderId, stored);
  return stored;
}
