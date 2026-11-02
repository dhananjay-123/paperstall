import { isPayPalCurrency, toMinor, type CurrencyCode } from "../money";
import type { Read, ReadItem } from "./schema";

// Checks run in code, never trusted to the model.

export type Flag = { itemId?: string; kind: "zero_price" | "outlier" | "duplicate" | "math" | "currency"; message: string; severity: "warn" | "block" };

export function currencyOf(read: Read): CurrencyCode | null {
  const c = read.currency.detected?.toUpperCase();
  return c && isPayPalCurrency(c) ? c : null;
}

export function lineMinor(item: ReadItem, currency: CurrencyCode): number {
  const qty = item.quantity && item.quantity > 0 ? Math.round(item.quantity) : 1;
  return toMinor(item.unitPrice, currency) * qty;
}

export function computedTotalMinor(read: Read, currency: CurrencyCode): number {
  return read.items.reduce((n, it) => n + lineMinor(it, currency), 0);
}

export function taxMinorOf(read: Read, currency: CurrencyCode): number {
  return read.tax && read.tax > 0 ? toMinor(read.tax, currency) : 0;
}

/**
 * The tax rate in basis points, applied to every cart. A stated rate wins (menus); otherwise the
 * paper's tax amount over its subtotal (bills and receipts).
 */
export function taxRateBp(read: Read, currency: CurrencyCode): number {
  if (read.taxRate && read.taxRate > 0) return Math.min(5000, Math.round(read.taxRate * 100));
  const items = computedTotalMinor(read, currency);
  const tax = taxMinorOf(read, currency);
  return items > 0 && tax > 0 ? Math.min(5000, Math.round((tax / items) * 10_000)) : 0;
}

export type MathCheck = { written: number; computed: number; ok: boolean } | null;

/** Written total vs. lines + written tax. */
export function mathCheck(read: Read, currency: CurrencyCode): MathCheck {
  if (read.writtenTotal === undefined || read.writtenTotal === null) return null;
  const written = toMinor(read.writtenTotal, currency);
  const computed = computedTotalMinor(read, currency) + taxMinorOf(read, currency);
  return { written, computed, ok: written === computed };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function sanityFlags(read: Read): Flag[] {
  const flags: Flag[] = [];
  const prices = read.items.map((i) => i.unitPrice).filter((p) => p > 0);
  const med = prices.length >= 3 ? median(prices) : null;
  const seen = new Map<string, string>();
  for (const it of read.items) {
    if (!(it.unitPrice > 0)) flags.push({ itemId: it.id, kind: "zero_price", severity: "block", message: `“${it.nameEn}” has no valid price.` });
    else if (med && it.unitPrice > med * 100) flags.push({ itemId: it.id, kind: "outlier", severity: "warn", message: `“${it.nameEn}” costs over 100× the typical item here. Is that right?` });
    const key = `${norm(it.nameEn)}|${it.unitPrice}`;
    if (seen.has(key)) flags.push({ itemId: it.id, kind: "duplicate", severity: "warn", message: `“${it.nameEn}” appears twice.` });
    else seen.set(key, it.id);
  }
  return flags;
}
