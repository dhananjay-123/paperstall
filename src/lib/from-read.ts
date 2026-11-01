"use client";

import { toMinor, type CurrencyCode } from "@/core/money";
import type { MarketMatch } from "@/core/market";
import type { Read } from "@/core/read/schema";
import type { StallItem } from "@/core/stall";

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20) || "item";

/** Read items → stall items in minor units, with unique short ids. */
export function stallItemsFromRead(
  read: Read,
  currency: CurrencyCode,
  market: Record<string, MarketMatch | null> = {},
  usePhoto: Record<string, boolean> = {},
): StallItem[] {
  const used = new Set<string>();
  return read.items
    .filter((it) => it.unitPrice > 0)
    .map((it) => {
      let id = slug(it.nameEn);
      for (let n = 2; used.has(id); n++) id = `${slug(it.nameEn).slice(0, 18)}-${n}`;
      used.add(id);
      const m = market[it.id];
      const orig = it.nameOriginal.trim() !== it.nameEn.trim() ? it.nameOriginal.slice(0, 80) : undefined;
      return {
        id,
        name: it.nameEn.slice(0, 80) || "Item",
        ...(orig ? { orig } : {}),
        price: toMinor(it.unitPrice, currency),
        ...(it.unit ? { unit: it.unit.slice(0, 30) } : {}),
        ...(it.description ? { desc: it.description.slice(0, 140) } : {}),
        ...(m && m.currency === currency ? { mkt: [toMinor(m.min, currency), toMinor(m.max, currency)] as [number, number] } : {}),
        ...(m?.image && usePhoto[it.id] && m.image.length <= 400 ? { img: m.image } : {}),
        _readId: it.id,
      } as StallItem & { _readId: string };
    });
}
