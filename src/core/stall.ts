import { z } from "zod";
import { isPayPalCurrency, sumLines, toPayPalValue, type CurrencyCode } from "./money";

export const STALL_VERSION = 1;

export const StallItem = z.object({
  id: z.string().min(1).max(24),
  name: z.string().min(1).max(80), // English name shown to buyers
  orig: z.string().max(80).optional(), // as written, if different
  price: z.number().int().positive().max(100_000_000), // minor units
  unit: z.string().max(30).optional(),
  desc: z.string().max(140).optional(),
  // Market range stored at publish time for the concierge ("is this a good price?").
  mkt: z.tuple([z.number().int(), z.number().int()]).optional(),
  // Product photo from the market check, only when the seller opted in.
  img: z.url().max(400).optional(),
});
export type StallItem = z.infer<typeof StallItem>;

// The public, URL-borne part of a stall. Short keys keep the QR scannable.
export const StallPayload = z.object({
  v: z.literal(STALL_VERSION),
  id: z.string().uuid(),
  n: z.string().min(1).max(60), // business name
  k: z.string().max(40).optional(), // kind, e.g. "coffee cart"
  c: z.string().refine(isPayPalCurrency, "Unsupported currency"),
  p: z.email().max(127), // payee email
  i: z.array(StallItem).min(1).max(40),
  t: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), // ink colour
  l: z.string().max(12).optional(), // source language
  x: z.number().int().positive(), // expiry, unix seconds
});
export type StallPayload = z.infer<typeof StallPayload>;

/** The seller's local view of a stall: payload + things that never go in the URL. */
export type Stall = {
  id: string;
  payload: StallPayload;
  signed: string; // "<lz>.<sig>" — the hash of the public link
  createdAt: string;
  intent: "shop" | "invoice" | "subscription";
  sourceImage?: string; // small thumbnail of the paper
  metrics?: { photoToPublishMs?: number; editsPerItem?: number };
};

export type CartLine = { id: string; qty: number };

export const Cart = z.array(z.object({ id: z.string().max(24), qty: z.number().int().min(1).max(99) })).min(1).max(40);

export type PricedCart = {
  currency: CurrencyCode;
  lines: { item: StallItem; qty: number; lineMinor: number }[];
  totalMinor: number;
  total: string; // PayPal decimal
};

/** Prices a cart purely from the stall payload. Client-sent prices are never used. */
export function priceCart(stall: StallPayload, cart: CartLine[]): PricedCart {
  const byId = new Map(stall.i.map((it) => [it.id, it]));
  const merged = new Map<string, number>();
  for (const l of cart) merged.set(l.id, (merged.get(l.id) ?? 0) + l.qty);
  const lines = [...merged].map(([id, qty]) => {
    const item = byId.get(id);
    if (!item) throw new Error(`Unknown item ${id}`);
    if (qty < 1 || qty > 99 || !Number.isInteger(qty)) throw new Error("Bad quantity");
    return { item, qty, lineMinor: item.price * qty };
  });
  if (!lines.length) throw new Error("Cart is empty");
  const currency = stall.c as CurrencyCode;
  const totalMinor = sumLines(lines.map((l) => ({ unitMinor: l.item.price, quantity: l.qty })));
  return { currency, lines, totalMinor, total: toPayPalValue(totalMinor, currency) };
}
