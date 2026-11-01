import { describe, expect, it } from "vitest";
import { bestMatch, matchConfidence, priceGuard, type C3Product } from "./market";
import { mathCheck, sanityFlags } from "./read/checks";
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
