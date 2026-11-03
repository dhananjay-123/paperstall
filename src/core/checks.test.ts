import { describe, expect, it } from "vitest";
import { bestMatch, isAccessoryListing, matchConfidence, priceGuard, type C3Product, type MarketOffer } from "./market";
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

describe("accessory listings", () => {
  it("keeps cases, skins and 'for AirPods' listings out of an AirPods match", () => {
    expect(isAccessoryListing("AirPods Pro 2", "Apex Case for AirPods Pro 2, Shockproof")).toBe(true);
    expect(isAccessoryListing("AirPods Pro 2", "Silicone Cover Compatible with AirPods Pro 2nd Gen")).toBe(true);
    expect(isAccessoryListing("AirPods Pro 2", "Ear Tips for AirPods Pro 2")).toBe(true);
    expect(isAccessoryListing("AirPods Pro 2", "Apple AirPods Pro 2 Wireless Earbuds with MagSafe Charging Case (USB-C)")).toBe(false);
    expect(isAccessoryListing("AirPods Pro 2 case", "Apex Case for AirPods Pro 2")).toBe(false);
  });

  it("matches the real product even when knock-offs are cheaper", () => {
    const at = (p: C3Product, store: string): C3Product => ({ ...p, offers: p.offers?.map((o) => ({ ...o, url: `https://${store}/p`, domain: store })) });
    const real = [at(product("Apple AirPods Pro 2 with MagSafe Charging Case", "Apple", [199]), "a.example"), at(product("AirPods Pro 2", "Apple", [229]), "b.example")];
    const fakes = [at(product("Apex Case for AirPods Pro 2", "Apex", [23.95]), "c.example"), at(product("Case Compatible with AirPods Pro 2", "Generic", [29.99]), "d.example")];
    expect(bestMatch("AirPods Pro 2", [...fakes, ...real], "USD")).toMatchObject({ min: 199, max: 229 });
  });

  // What Channel3 returned for "AirPods Pro 2" on 43f242a: a Burga case scored 1.0 and cheap
  // listings pooled with it into "$17.99–$23.95 · 3 stores".
  const burga: C3Product = {
    id: "c3_burga_apex",
    title: "Apex - AirPods Pro 2 Case",
    brands: [{ id: "burga", name: "Burga" }],
    offers: [{ url: "https://burga.us/products/apex-airpods-pro-2-case", domain: "burga.us", price: { price: 23.95, currency: "USD", compare_at_price: null }, availability: "InStock", condition: "new" }],
  };
  const cheap = [
    { ...product("AirPods Pro 2", "Generic", [17.99]), id: "g1" },
    { ...product("AirPods Pro 2nd Generation Earbuds", "Unbranded", [19.99]), id: "g2" },
  ].map((p, i) => ({ ...p, offers: p.offers?.map((o) => ({ ...o, url: `https://cheap${i}.example/p`, domain: `cheap${i}.example` })) }));

  it("does not match an AirPods case from another brand", () => {
    expect(isAccessoryListing("AirPods Pro 2", burga.title)).toBe(true);
    expect(matchConfidence("AirPods Pro 2", burga)).toBe(0);
    expect(matchConfidence("AirPods Pro 2", { ...burga, brands: [{ name: "Apple" }] })).toBeLessThan(0.75);
    expect(bestMatch("AirPods Pro 2", [burga, ...cheap], "USD")).toBeNull();
  });

  it("finds the real AirPods range next to the Burga case", () => {
    const at = (p: C3Product, store: string): C3Product => ({ ...p, offers: p.offers?.map((o) => ({ ...o, url: `https://${store}/p`, domain: store })) });
    const real = [at(product("Apple AirPods Pro 2 Wireless Earbuds with MagSafe Charging Case (USB-C)", "Apple", [189.99]), "a.example"), at(product("AirPods Pro 2", "Apple", [249]), "b.example")];
    expect(bestMatch("AirPods Pro 2", [burga, ...cheap, ...real], "USD")).toMatchObject({ min: 189.99, max: 249, brand: "Apple" });
  });

  it("keeps brand-less queries and Apple watch names working", () => {
    expect(matchConfidence("Anker 10000mAh power bank", product("Anker PowerCore 10000mAh Power Bank", "Anker", [29]))).toBe(1);
    expect(isAccessoryListing("Apple Watch Series 9", "Apple Watch Series 9 GPS 41mm Midnight Aluminum Case Midnight Sport Band")).toBe(false);
    expect(isAccessoryListing("Xiaomi Smart Band 8", "Xiaomi Smart Band 8 Fitness Tracker")).toBe(false);
  });
});

describe("priceGuard", () => {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const offers = (prices: number[]): MarketOffer[] => prices.map((price, i) => ({ retailer: `s${i}.example`, price, url: `https://s${i}.example/p`, inStock: true }));
  const airpods = { title: "Apple AirPods (3rd generation)", min: 129, max: 179, median: 169, confidence: 1, offers: offers([129, 169, 179]) };
  it("suggests a decimal-shift fix for a typo", () => {
    expect(priceGuard(16.9, airpods, fmt)).toMatchObject({ kind: "too_low", fix: 169 });
  });
  it("falls back to the median when no shift fits", () => {
    expect(priceGuard(3.5, airpods, fmt)).toMatchObject({ kind: "too_low", fix: 169, message: "$3.50 for Apple AirPods? Did you mean $169.00?" });
  });
  it("names the seller's own item, not the store's listing", () => {
    expect(priceGuard(16.9, airpods, fmt, "AirPods 3")?.message).toBe("$16.90 for AirPods 3? Did you mean $169.00?");
  });
  it("stays quiet on a weak match or when fewer than three stores agree", () => {
    expect(priceGuard(16.9, { ...airpods, confidence: 0.8 }, fmt)).toBeNull();
    expect(priceGuard(16.9, { ...airpods, offers: offers([129, 179]) }, fmt)).toBeNull();
  });
  it("never calls a real retail price a slip because cheap listings matched", () => {
    // $199 AirPods Pro 2 against $23.95–$29.99 listings: must not suggest $19.90.
    const cheap = { title: "Apex Case", min: 23.95, max: 29.99, median: 26, confidence: 1, offers: offers([23.95, 26, 29.99]) };
    expect(priceGuard(199, cheap, fmt, "AirPods Pro 2")).toBeNull();
    expect(priceGuard(2600, cheap, fmt, "Widget")).toMatchObject({ kind: "too_high", fix: 26 });
  });
  it("never talks a normal retail price down to a fraction of it", () => {
    // The exact 43f242a match: AirPods Pro 2 written at $199 against $17.99–$23.95.
    const wrong = { query: "AirPods Pro 2", currency: "USD", title: "Apex - AirPods Pro 2 Case", min: 17.99, max: 23.95, median: 19.99, confidence: 1, offers: offers([17.99, 19.99, 23.95]) };
    expect(priceGuard(199, wrong, fmt, "AirPods Pro 2")).toBeNull();
    // Outside the band it is still a slip.
    expect(priceGuard(1990, wrong, fmt, "AirPods Pro 2")).toMatchObject({ kind: "too_high", fix: 19.9 });
  });
  it("still catches the JBL Go 4 demo slip", () => {
    const jbl = { query: "JBL Go 4", currency: "USD", title: "JBL Go 4 Portable Speaker", min: 44.95, max: 49.95, median: 49.95, confidence: 1, offers: offers([44.95, 49.95, 49.95]) };
    expect(priceGuard(4.9, jbl, fmt, "JBL Go 4")).toMatchObject({ kind: "too_low", fix: 49, message: "$4.90 for JBL Go 4? Did you mean $49.00?" });
  });
  it("stays quiet inside 25%–300% of the market", () => {
    expect(priceGuard(150, airpods, fmt)).toBeNull();
    expect(priceGuard(60, airpods, fmt)).toBeNull();
  });
});
