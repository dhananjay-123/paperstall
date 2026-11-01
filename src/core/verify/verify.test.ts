import { describe, expect, it } from "vitest";
import type { StallPayload } from "../stall";
import { verifyOrder, type OrderFacts } from "./index";

const stall: StallPayload = {
  v: 1,
  id: "6f1c2a7e-8b0d-4c3e-9a51-2f6d7e8a9b0c",
  n: "Rosa's Coffee Cart",
  c: "USD",
  p: "rosa@business.example.com",
  i: [
    { id: "latte", name: "Latte", price: 400 },
    { id: "croissant", name: "Croissant", price: 300 },
  ],
  x: 4_000_000_000,
};

function order(over: Partial<OrderFacts["purchase_units"][0]> = {}, status = "COMPLETED", captureStatus = "COMPLETED"): OrderFacts {
  return {
    id: "ORDER1",
    status,
    purchase_units: [
      {
        custom_id: stall.id,
        amount: { currency_code: "USD", value: "11.00" },
        payee: { email_address: "Rosa@Business.example.com" },
        items: [
          { name: "Latte", quantity: "2", unit_amount: { currency_code: "USD", value: "4.00" }, sku: "latte" },
          { name: "Croissant", quantity: "1", unit_amount: { currency_code: "USD", value: "3.00" }, sku: "croissant" },
        ],
        payments: { captures: [{ id: "CAP1", status: captureStatus, amount: { currency_code: "USD", value: "11.00" }, create_time: "2026-11-02T19:42:00Z" }] },
        ...over,
      },
    ],
  };
}

describe("verifyOrder", () => {
  it("passes a completed, correctly paid order and lists what was bought", () => {
    const v = verifyOrder(order(), stall);
    expect(v).toMatchObject({ ok: true, orderId: "ORDER1", captureId: "CAP1", totalMinor: 1100 });
    expect(v.ok && v.items).toEqual([
      { id: "latte", name: "Latte", quantity: 2 },
      { id: "croissant", name: "Croissant", quantity: 1 },
    ]);
  });

  it("not_paid: order approved but not captured, or capture pending", () => {
    expect(verifyOrder(order({ payments: { captures: [] } }, "APPROVED"), stall)).toMatchObject({ ok: false, reason: "not_paid", message: "Not paid yet" });
    expect(verifyOrder(order({}, "COMPLETED", "PENDING"), stall)).toMatchObject({ reason: "not_paid" });
  });

  it("wrong_payee: money went to another account", () => {
    expect(verifyOrder(order({ payee: { email_address: "scammer@example.com" } }), stall)).toMatchObject({ reason: "wrong_payee", message: "Paid to someone else" });
  });

  it("amount_mismatch: unit price, total, capture or unknown item disagree with the stall", () => {
    expect(verifyOrder(order({ amount: { currency_code: "USD", value: "1.00" } }), stall)).toMatchObject({ reason: "amount_mismatch" });
    const cheapLatte = order();
    cheapLatte.purchase_units[0].items![0].unit_amount.value = "0.40";
    expect(verifyOrder(cheapLatte, stall)).toMatchObject({ reason: "amount_mismatch" });
    const short = order();
    short.purchase_units[0].payments!.captures![0].amount.value = "10.00";
    expect(verifyOrder(short, stall)).toMatchObject({ reason: "amount_mismatch" });
    const unknown = order();
    unknown.purchase_units[0].items![0].sku = "gold-bar";
    expect(verifyOrder(unknown, stall)).toMatchObject({ reason: "amount_mismatch" });
  });

  it("currency_mismatch", () => {
    expect(verifyOrder(order({ amount: { currency_code: "EUR", value: "11.00" } }), stall)).toMatchObject({ reason: "currency_mismatch" });
  });

  it("wrong_stall: an order for a different stall", () => {
    expect(verifyOrder(order({ custom_id: "someone-else" }), stall)).toMatchObject({ reason: "wrong_stall" });
  });

  it("already_recorded: replay by order id or capture id, with the original time", () => {
    expect(verifyOrder(order(), stall, { orderIds: ["ORDER1"], captureIds: [], recordedAt: { ORDER1: "2026-11-02T19:42:00Z" } })).toMatchObject({
      reason: "already_recorded",
      recordedAt: "2026-11-02T19:42:00Z",
    });
    expect(verifyOrder(order(), stall, { orderIds: [], captureIds: ["CAP1"] })).toMatchObject({ reason: "already_recorded" });
  });
});
