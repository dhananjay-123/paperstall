import LZString from "lz-string";
import { describe, expect, it } from "vitest";
import { ownerToken, peekStall, signReceipt, signStall, verifyOwner, verifyReceipt, verifyStall } from "./signing";
import { isHttps } from "./market";
import { StallItem } from "./stall";
import { priceCart, type StallPayload } from "./stall";

const SECRET = "test-secret-test-secret-test-secret-123";
const stall: StallPayload = {
  v: 1,
  id: "6f1c2a7e-8b0d-4c3e-9a51-2f6d7e8a9b0c",
  n: "Rosa's Coffee Cart",
  c: "USD",
  p: "seller@example.com",
  i: [
    { id: "latte", name: "Latte", price: 400 },
    { id: "croissant", name: "Croissant", price: 300 },
  ],
  x: 4_000_000_000,
};

describe("stall signing", () => {
  it("round-trips a signed stall", () => {
    const signed = signStall(stall, SECRET);
    const v = verifyStall(signed, SECRET);
    expect(v.ok && v.payload.n).toBe("Rosa's Coffee Cart");
    expect(peekStall(signed)?.i).toHaveLength(2);
  });

  it("rejects a price edited in the URL", () => {
    const signed = signStall(stall, SECRET);
    const [data, sig] = signed.split(".");
    const json = JSON.parse(LZString.decompressFromEncodedURIComponent(data)!);
    json.i[0].price = 1;
    const forged = `${LZString.compressToEncodedURIComponent(JSON.stringify(json))}.${sig}`;
    expect(verifyStall(forged, SECRET)).toEqual({ ok: false, reason: "tampered" });
  });

  it("rejects a different secret, expiry and junk", () => {
    const signed = signStall(stall, SECRET);
    expect(verifyStall(signed, "another-secret-another-secret-another").ok).toBe(false);
    expect(verifyStall(signed, SECRET, 4_000_000_001)).toEqual({ ok: false, reason: "expired" });
    expect(verifyStall("nope", SECRET)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyStall("x".repeat(10_000), SECRET)).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses to sign an invalid payload", () => {
    expect(() => signStall({ ...stall, c: "XYZ" as StallPayload["c"] }, SECRET)).toThrow();
    expect(() => signStall({ ...stall, i: [{ id: "a", name: "A", price: -5 }] }, SECRET)).toThrow();
  });
});

describe("receipt QR", () => {
  it("verifies its own receipts and rejects forgeries", () => {
    const code = signReceipt("5O190127TN364715T", stall.id, SECRET);
    expect(verifyReceipt(code, SECRET)).toEqual({ ok: true, orderId: "5O190127TN364715T", stallId: stall.id });
    expect(verifyReceipt(code.replace("5O19", "5O18"), SECRET)).toEqual({ ok: false });
    expect(verifyReceipt("hello", SECRET)).toEqual({ ok: false });
  });
});

describe("priceCart", () => {
  it("prices from the stall and merges duplicate lines", () => {
    const p = priceCart(stall, [{ id: "latte", qty: 2 }, { id: "croissant", qty: 1 }, { id: "latte", qty: 1 }]);
    expect(p.totalMinor).toBe(1500);
    expect(p.total).toBe("15.00");
    expect(p.lines.find((l) => l.item.id === "latte")?.qty).toBe(3);
  });

  it("rejects unknown items and bad quantities", () => {
    expect(() => priceCart(stall, [{ id: "free-money", qty: 1 }])).toThrow();
    expect(() => priceCart(stall, [{ id: "latte", qty: 0 }])).toThrow();
    expect(() => priceCart(stall, [])).toThrow();
  });
});

describe("owner tokens", () => {
  const id = stall.id;
  it("accepts the token minted for that id", () => {
    expect(verifyOwner("stall", id, ownerToken("stall", id, SECRET), SECRET)).toBe(true);
  });
  it("rejects a missing, wrong-id, wrong-kind or wrong-secret token", () => {
    expect(verifyOwner("stall", id, undefined, SECRET)).toBe(false);
    expect(verifyOwner("stall", id, "", SECRET)).toBe(false);
    expect(verifyOwner("stall", id, ownerToken("stall", "11111111-2222-4333-8444-555555555555", SECRET), SECRET)).toBe(false);
    expect(verifyOwner("stall", id, ownerToken("invoice", id, SECRET), SECRET)).toBe(false);
    expect(verifyOwner("stall", id, ownerToken("stall", id, `${SECRET}x`), SECRET)).toBe(false);
  });
});

describe("third-party URLs", () => {
  it("keeps only https", () => {
    expect(isHttps("https://shop.example/p/1")).toBe(true);
    expect(isHttps("javascript:alert(1)")).toBe(false);
    expect(isHttps("http://shop.example")).toBe(false);
    expect(isHttps("data:text/html,x")).toBe(false);
    expect(isHttps(undefined)).toBe(false);
  });
  it("refuses non-https item photos in a stall", () => {
    const base = { id: "a", name: "A", price: 100 };
    expect(StallItem.safeParse({ ...base, img: "https://cdn.example/a.jpg" }).success).toBe(true);
    expect(StallItem.safeParse({ ...base, img: "javascript:alert(1)" }).success).toBe(false);
    expect(StallItem.safeParse({ ...base, img: "http://cdn.example/a.jpg" }).success).toBe(false);
  });
});
