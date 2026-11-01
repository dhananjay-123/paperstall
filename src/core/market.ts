// Market check: turn Channel3 search results into a range a seller can trust, or nothing.

export type C3Offer = { url: string; domain: string; price: { price: number; currency: string; compare_at_price?: number | null }; availability: string; condition?: string | null };
export type C3Product = {
  id: string;
  title: string;
  brands?: { id?: string; name: string }[];
  images?: { url: string; cleaned_url?: string | null; is_main_image?: boolean }[];
  key_features?: string[] | null;
  offers?: C3Offer[];
};

export type MarketOffer = { retailer: string; price: number; url: string; inStock: boolean };

export type MarketMatch = {
  query: string;
  productId: string;
  title: string;
  brand?: string;
  image?: string;
  features: string[];
  confidence: number; // 0–1
  currency: string;
  min: number; // decimal, in `currency`
  max: number;
  median: number;
  stores: number;
  offers: MarketOffer[]; // top 5 by price
  suggested: number;
  checkedAt: string;
};

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .split(" ")
    .filter((t) => t.length > 1 || /\d/.test(t));

/** Tokens like "3", "10000mah", "s24", "airpods" — model identifiers must match exactly. */
const isModelish = (t: string) => /\d/.test(t);

export function matchConfidence(query: string, p: C3Product): number {
  const q = tokens(query);
  if (!q.length) return 0;
  const hay = new Set(tokens(`${p.brands?.map((b) => b.name).join(" ") ?? ""} ${p.title}`));
  const hits = q.filter((t) => hay.has(t)).length;
  const models = q.filter(isModelish);
  // A wrong model number (Go 3 vs Go 4) is a wrong product: never show it.
  if (models.some((m) => !hay.has(m))) return Math.min(0.3, hits / q.length);
  const brandHit = p.brands?.some((b) => q.includes(b.name.toLowerCase())) ?? false;
  return Math.min(1, hits / q.length + (brandHit ? 0.1 : 0));
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const MIN_CONFIDENCE = 0.75;

export function bestMatch(query: string, products: C3Product[], currency: string, now = new Date()): MarketMatch | null {
  let best: { p: C3Product; c: number } | null = null;
  for (const p of products) {
    const c = matchConfidence(query, p);
    if (!best || c > best.c) best = { p, c };
  }
  if (!best || best.c < MIN_CONFIDENCE) return null;
  const offers = (best.p.offers ?? []).filter(
    (o) => o.price?.currency?.toUpperCase() === currency.toUpperCase() && o.price.price > 0 && (o.condition ?? "new") === "new",
  );
  const inStock = offers.filter((o) => o.availability === "InStock");
  const pool = inStock.length >= 2 ? inStock : offers;
  if (pool.length < 2) return null; // one listing isn't a market
  const prices = pool.map((o) => o.price.price);
  const med = median(prices);
  const image = best.p.images?.find((i) => i.is_main_image) ?? best.p.images?.[0];
  return {
    query,
    productId: best.p.id,
    title: best.p.title,
    brand: best.p.brands?.[0]?.name,
    image: image?.cleaned_url ?? image?.url,
    features: (best.p.key_features ?? []).slice(0, 4),
    confidence: Number(best.c.toFixed(2)),
    currency: currency.toUpperCase(),
    min: Math.min(...prices),
    max: Math.max(...prices),
    median: med,
    stores: new Set(pool.map((o) => o.domain)).size,
    offers: [...pool]
      .sort((a, b) => a.price.price - b.price.price)
      .slice(0, 5)
      .map((o) => ({ retailer: o.domain, price: o.price.price, url: o.url, inStock: o.availability === "InStock" })),
    // Small sellers compete on convenience, not shipping: a touch under the median.
    suggested: Math.max(0.01, Math.round(med * 0.95 * 100) / 100),
    checkedAt: now.toISOString(),
  };
}

export type PriceGuard = { kind: "too_low" | "too_high"; message: string; fix: number } | null;

/** Typo-style warning when the written price is far outside the market. */
export function priceGuard(written: number, m: Pick<MarketMatch, "median" | "min" | "max" | "title">, fmt: (n: number) => string): PriceGuard {
  if (!(written > 0)) return null;
  const ratio = written / m.median;
  if (ratio >= 0.25 && ratio <= 3) return null;
  // Most handwriting slips are a shifted decimal: try ×10/×100 or ÷10/÷100 first.
  const shifts = ratio < 0.25 ? [10, 100] : [0.1, 0.01];
  const shifted = shifts.map((f) => Math.round(written * f * 100) / 100).find((v) => v >= m.min * 0.8 && v <= m.max * 1.2);
  const fix = shifted ?? Math.round(m.median * 100) / 100;
  const short = m.title.split(/[,(|-]/)[0].trim().slice(0, 40);
  return {
    kind: ratio < 0.25 ? "too_low" : "too_high",
    message: `${fmt(written)} for ${short}? Did you mean ${fmt(fix)}?`,
    fix,
  };
}
