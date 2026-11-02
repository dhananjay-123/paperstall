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

// Words that make a listing a thing *for* the product (a case, a skin, a knock-off), not the product.
const ACCESSORY_WORDS = /\b(compatible|replacement|cover|covers|skin|skins|sleeve|protector|protective|silicone|strap|holder|keychain|ear ?tips|decal|sticker|dummy|replica|clone|accessor(?:y|ies))\b/;
const ACCESSORY_FOR = /\b(case|cases|charger|cable|stand|mount|dock|adapter)\s+(for|compatible)\b/;

/** "Apex Case for AirPods Pro 2" is not AirPods Pro 2, unless the seller is selling cases. */
export function isAccessoryListing(query: string, title: string): boolean {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  // The seller is selling the accessory itself: accessory listings are the market.
  if (ACCESSORY_WORDS.test(q) || /\b(case|cases|charger|cable|stand|mount|dock|adapter)\b/.test(q) || /\bfor\b/.test(q)) return false;
  if (ACCESSORY_WORDS.test(t) || ACCESSORY_FOR.test(t)) return true;
  // "... for AirPods": a product for one of the words the seller wrote.
  const forWhat = /\bfor\s+(?:apple\s+|the\s+|new\s+)?([\p{L}\p{N}]+)/u.exec(t)?.[1];
  return Boolean(forWhat && tokens(query).includes(forWhat));
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const MIN_CONFIDENCE = 0.75;
const POOL_SLACK = 0.05;

export function bestMatch(query: string, products: C3Product[], currency: string, now = new Date()): MarketMatch | null {
  // Channel3 often lists one product as several entries with one store each, so pool the
  // entries that match as well as the best one. A near miss ("AirPods Max 2" for "AirPods
  // Pro 2" scores 0.85) is a different product and stays out.
  const scored = products
    .filter((p) => !isAccessoryListing(query, p.title))
    .map((p) => ({ p, c: matchConfidence(query, p) }))
    .filter((m) => m.c >= MIN_CONFIDENCE)
    .sort((a, b) => b.c - a.c);
  const best = scored[0];
  if (!best) return null;
  const matched = scored.filter((m) => m.c >= best.c - POOL_SLACK);
  const seen = new Set<string>();
  const offers = matched
    .flatMap((m) => m.p.offers ?? [])
    .filter((o) => o.price?.currency?.toUpperCase() === currency.toUpperCase() && o.price.price > 0 && (o.condition ?? "new") === "new")
    .filter((o) => isHttps(o.url) && !seen.has(o.url) && !!seen.add(o.url));
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
    image: [image?.cleaned_url, image?.url].find(isHttps),
    features: (best.p.key_features ?? []).slice(0, 4),
    confidence: Number(best.c.toFixed(2)),
    currency: currency.toUpperCase(),
    min: Math.min(...prices),
    max: Math.max(...prices),
    median: med,
    stores: new Set(pool.map((o) => o.domain)).size,
    offers: [...pool]
      .sort((a, b) => a.price.price - b.price.price)
      .filter((o, i, all) => all.findIndex((x) => x.domain === o.domain) === i) // cheapest per store
      .slice(0, 5)
      .map((o) => ({ retailer: o.domain, price: o.price.price, url: o.url, inStock: o.availability === "InStock" })),
    // Small sellers compete on convenience, not shipping: a touch under the median.
    suggested: Math.max(0.01, Math.round(med * 0.95 * 100) / 100),
    checkedAt: now.toISOString(),
  };
}

/** Third-party links and photos end up in href/src, so only plain https URLs are kept. */
export function isHttps(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export type PriceGuard = { kind: "too_low" | "too_high"; message: string; fix: number } | null;

/** The guard calls a written price a slip, so it needs a closer match than the range shown beside it. */
export const GUARD_CONFIDENCE = 0.85;
const GUARD_STORES = 3;

/**
 * Typo-style warning when the written price is far outside the market. It speaks only when the
 * match is strong and at least three stores agree on the price, and names the seller's own item.
 */
export function priceGuard(
  written: number,
  m: Pick<MarketMatch, "median" | "min" | "max" | "title" | "confidence" | "offers">,
  fmt: (n: number) => string,
  itemName?: string,
): PriceGuard {
  if (!(written > 0) || m.confidence < GUARD_CONFIDENCE) return null;
  const agree = m.offers.filter((o) => o.price >= m.median * 0.6 && o.price <= m.median * 1.6).length;
  if (agree < GUARD_STORES) return null;
  const ratio = written / m.median;
  if (ratio >= 0.25 && ratio <= 3) return null;
  // Most handwriting slips are a shifted decimal: try ×10/×100 or ÷10/÷100 first.
  const tooHigh = ratio > 3;
  const shifts = tooHigh ? [0.1, 0.01] : [10, 100];
  // A high price may just be the real thing next to cheaper listings, so only a shift that lands
  // squarely inside the market counts as a slip; never fall back to "did you mean the median?".
  const [lo, hi] = tooHigh ? [m.min * 0.9, m.max * 1.1] : [m.min * 0.8, m.max * 1.2];
  const shifted = shifts.map((f) => Math.round(written * f * 100) / 100).find((v) => v >= lo && v <= hi);
  if (tooHigh && shifted === undefined) return null;
  const fix = shifted ?? Math.round(m.median * 100) / 100;
  const short = (itemName?.trim() || m.title.split(/[,(|-]/)[0].trim()).slice(0, 40);
  return {
    kind: ratio < 0.25 ? "too_low" : "too_high",
    message: `${fmt(written)} for ${short}? Did you mean ${fmt(fix)}?`,
    fix,
  };
}
