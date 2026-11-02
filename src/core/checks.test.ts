import { describe, expect, it } from "vitest";
import { bestMatch, matchConfidence, priceGuard, type C3Product } from "./market";
import { mathCheck, sanityFlags, taxRateBp } from "./read/checks";
import type { Read } from "./read/schema";

const base: Read = {
  intent: "invoice",
  intentReason: "x",
  business: {},
  sourceLanguage: "en",
  currency: { detected: "USD", confidence: 1 },
  items: [],
  questions: [],
  warnings: [],
};
const item = (id: string, nameEn: string, unitPrice: number, quantity?: number) => ({
  id,
  nameOriginal: nameEn,
  nameEn,
  unitPrice,
  quantity,
  box: [0, 0, 10, 10],
  confidence: 0.9,
});

describe("mathCheck", () => {
  it("catches a wrong handwritten total in integer cents", () => {
    const r = { ...base, items: [item("a", "Cards", 0.2, 200), item("b", "Design", 85)], writtenTotal: 115 };
    expect(mathCheck(r, "USD")).toEqual({ written: 11500, computed: 12500, ok: false });
  });
  it("passes a correct total and returns null with no written total", () => {
    expect(mathCheck({ ...base, items: [item("a", "A", 0.1, 3)], writtenTotal: 0.3 }, "USD")?.ok).toBe(true);
    expect(mathCheck({ ...base, items: [item("a", "A", 1)] }, "USD")).toBeNull();
  });
});

describe("tax", () => {
  // A real restaurant receipt: 8.40 + 7.40 + 4.97 + 0.44 = 21.21, tax 1.49, total 22.70.
  const receipt = { ...base, items: [item("a", "Pork Pillows", 8.4), item("b", "Shrimp Sub", 7.4), item("c", "Smoothie", 4.97), item("d", "Lychee", 0.44)], writtenTotal: 22.7 };
  it("counts the written tax toward the total", () => {
    expect(mathCheck(receipt, "USD")?.ok).toBe(false);
    expect(mathCheck({ ...receipt, tax: 1.49 }, "USD")).toEqual({ written: 2270, computed: 2270, ok: true });
  });
  it("turns the tax into a rate that reproduces it on the same subtotal", () => {
    const bp = taxRateBp({ ...receipt, tax: 1.49 }, "USD");
    expect(bp).toBeGreaterThan(700);
    expect(Math.round((2121 * bp) / 10_000)).toBe(149);
    expect(taxRateBp(receipt, "USD")).toBe(0);
  });
  it("prefers a rate stated on a menu", () => {
    expect(taxRateBp({ ...base, intent: "shop", items: [item("a", "Latte", 4.5)], taxRate: 8.25 }, "USD")).toBe(825);
  });
});

describe("sanityFlags", () => {
  it("flags zero prices, 100× outliers and duplicates", () => {
    const r = { ...base, items: [item("a", "Latte", 4), item("b", "Tea", 3), item("c", "Muffin", 0), item("d", "Cake", 900), item("e", "Latte", 4)] };
    const kinds = sanityFlags(r).map((f) => `${f.itemId}:${f.kind}`);
    expect(kinds).toContain("c:zero_price");
    expect(kinds).toContain("d:outlier");
    expect(kinds).toContain("e:duplicate");
    expect(kinds).not.toContain("a:duplicate");
  });
});

const product = (title: string, brand: string, prices: number[]): C3Product => ({
  id: title,
  title,
  brands: [{ name: brand }],
  offers: prices.map((p, i) => ({ url: `https://s${i}.example/p`, domain: `s${i}.example`, price: { price: p, currency: "USD" }, availability: "InStock" })),
});

describe("market match", () => {
  it("never accepts a different model number", () => {
    expect(matchConfidence("JBL Go 3", product("JBL Go 4 Portable Speaker", "JBL", [50]))).toBeLessThan(0.75);
    expect(matchConfidence("JBL Go 3", product("JBL Go 3 Portable Bluetooth Speaker", "JBL", [40]))).toBeGreaterThanOrEqual(0.75);
  });

  it("builds a range only from at least two same-currency listings", () => {
    const m = bestMatch("Anker 10000mAh power bank", [product("Anker PowerCore 10000mAh Power Bank", "Anker", [29, 35, 40])], "USD");
    expect(m).toMatchObject({ min: 29, max: 40, median: 35, stores: 3 });
    expect(bestMatch("Anker 10000mAh power bank", [product("Anker 10000mAh Power Bank", "Anker", [29])], "USD")).toBeNull();
    expect(bestMatch("Anker 10000mAh power bank", [product("Anker 10000mAh Power Bank", "Anker", [29, 30])], "EUR")).toBeNull();
  });

  it("pools single-store listings of the same product, but never other models", () => {
    // product() names every first offer s0.example, so give each listing its own store.
    const at = (p: C3Product, store: string): C3Product => ({ ...p, offers: p.offers?.map((o) => ({ ...o, url: `https://${store}/p`, domain: store })) });
    const a = at(product("Apple AirPods Pro 2 with ANC", "Apple", [309.99]), "hsn.example");
    const b = at(product("AirPods Pro 2 MagSafe", "Apple", [212.99]), "bestbuy.example");
    const other = at(product("AirPods Pro 3", "Apple", [199.99]), "costco.example");
    const nearMiss = at(product("AirPods Max 2", "Apple", [769.99]), "samsclub.example");
    const m = bestMatch("Apple AirPods Pro 2", [a, b, other, nearMiss], "USD");
    expect(m).toMatchObject({ min: 212.99, max: 309.99, stores: 2 });
  });
});

describe("priceGuard", () => {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const airpods = { title: "Apple AirPods (3rd generation)", min: 129, max: 179, median: 169 };
  it("suggests a decimal-shift fix for a typo", () => {
    expect(priceGuard(16.9, airpods, fmt)).toMatchObject({ kind: "too_low", fix: 169 });
  });
  it("falls back to the median when no shift fits", () => {
    expect(priceGuard(3.5, airpods, fmt)).toMatchObject({ kind: "too_low", fix: 169, message: "$3.50 for Apple AirPods? Did you mean $169.00?" });
  });
  it("stays quiet inside 25%–300% of the market", () => {
    expect(priceGuard(150, airpods, fmt)).toBeNull();
    expect(priceGuard(60, airpods, fmt)).toBeNull();
  });
});
