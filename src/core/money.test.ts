import { describe, expect, it } from "vitest";
import { convertMinor, fromPayPalValue, sumLines, toMinor, toPayPalValue } from "./money";

describe("money", () => {
  it("converts decimals to minor units without float drift", () => {
    expect(toMinor(1.005, "USD")).toBe(101);
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
    expect(toMinor(4, "USD")).toBe(400);
    expect(toMinor(1200, "JPY")).toBe(1200);
    expect(toMinor(-2.5, "EUR")).toBe(-250);
  });

  it("formats PayPal values", () => {
    expect(toPayPalValue(450, "USD")).toBe("4.50");
    expect(toPayPalValue(5, "USD")).toBe("0.05");
    expect(toPayPalValue(1200, "JPY")).toBe("1200");
    expect(() => toPayPalValue(1.5, "USD")).toThrow();
  });

  it("parses PayPal values", () => {
    expect(fromPayPalValue("4.50", "USD")).toBe(450);
    expect(fromPayPalValue("4.5", "USD")).toBe(450);
    expect(fromPayPalValue("10", "USD")).toBe(1000);
    expect(fromPayPalValue("1200", "JPY")).toBe(1200);
    expect(() => fromPayPalValue("4,50", "USD")).toThrow();
  });

  it("sums lines in integers", () => {
    expect(sumLines([{ unitMinor: 20, quantity: 200 }, { unitMinor: 1999, quantity: 3 }])).toBe(4000 + 5997);
    expect(() => sumLines([{ unitMinor: 100, quantity: 1.5 }])).toThrow();
  });

  it("converts currency with an explicit rate", () => {
    expect(convertMinor(1000, "EUR", "USD", 1.08)).toBe(1080);
    expect(() => convertMinor(1000, "EUR", "USD", 0)).toThrow();
  });
});
