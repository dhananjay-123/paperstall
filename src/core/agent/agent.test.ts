import { describe, expect, it, vi } from "vitest";
import { findOrder, resolveOrderProposal, runTool, TOOLS, type PennyOrder, type ReadExecutors } from "./index";

function readers(): ReadExecutors {
  return {
    list_unpaid_invoices: vi.fn(async () => []),
    list_orders: vi.fn(async () => []),
    get_invoice: vi.fn(async () => ({ status: "SENT" })),
    get_order: vi.fn(async () => ({ status: "COMPLETED" })),
    sales_summary: vi.fn(async () => ({ total: 0 })),
    check_market_price: vi.fn(async () => null),
  };
}

describe("approval gate", () => {
  const mutating = Object.entries(TOOLS).filter(([, d]) => d.effect === "mutate").map(([n]) => n);

  it("covers every tool that moves money or contacts a customer", () => {
    expect(mutating.sort()).toEqual(
      ["add_tracking", "cancel_invoice", "create_invoice_from_text", "create_payment_link_for_items", "refund_capture", "send_invoice_reminder"].sort(),
    );
  });

  it("never executes a mutating tool: it returns a proposal and calls no executor", async () => {
    const r = readers();
    const args: Record<string, unknown> = {
      add_tracking: { order: "2", trackingNumber: "1Z999", carrier: "UPS" },
      cancel_invoice: { invoiceId: "INV2-AAAA-BBBB-CCCC-DDDD" },
      create_invoice_from_text: { customerName: "Northwind", items: [{ name: "Cards", quantity: 200, unitPrice: 0.2 }] },
      create_payment_link_for_items: { name: "Mug", price: 12 },
      refund_capture: { order: "3", fraction: 0.5 },
      send_invoice_reminder: { invoiceId: "INV2-AAAA-BBBB-CCCC-DDDD" },
    };
    for (const name of mutating) {
      const out = await runTool(name, args[name], r, () => "p1");
      expect(out).toMatchObject({ kind: "proposal", tool: name, proposal: { id: "p1", tool: name } });
    }
    for (const fn of Object.values(r)) expect(fn).not.toHaveBeenCalled();
  });

  it("runs read tools directly", async () => {
    const r = readers();
    expect(await runTool("get_order", { orderId: "O1" }, r)).toEqual({ kind: "result", tool: "get_order", data: { status: "COMPLETED" } });
    expect(r.get_order).toHaveBeenCalledWith({ orderId: "O1" });
  });

  it("rejects unknown tools and invalid arguments without running anything", async () => {
    const r = readers();
    expect(await runTool("transfer_all_money", {}, r)).toMatchObject({ kind: "error" });
    expect(await runTool("refund_capture", { order: "3", amount: -5 }, r)).toMatchObject({ kind: "error" });
    expect(await runTool("refund_capture", { order: "3", fraction: 1.5 }, r)).toMatchObject({ kind: "error" });
    expect(await runTool("sales_summary", { period: "forever" }, r)).toMatchObject({ kind: "error" });
    for (const fn of Object.values(r)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("resolveOrderProposal", () => {
  const orders: PennyOrder[] = [
    { n: 1, id: "1AB23456CD789012E", at: "2026-11-03T10:00:00Z", lines: [{ name: "Coffee", quantity: 1, unitMinor: 300 }], totalMinor: 300, refundedMinor: 0, currency: "USD", captured: true },
    {
      n: 2,
      id: "6VU297505J010243X",
      at: "2026-11-03T11:00:00Z",
      lines: [
        { name: "Al pastor", quantity: 2, unitMinor: 900 },
        { name: "Horchata", quantity: 1, unitMinor: 300 },
      ],
      totalMinor: 2100,
      refundedMinor: 0,
      currency: "USD",
      captured: true,
    },
  ];
  const refund = (args: Record<string, unknown>) => resolveOrderProposal({ id: "p", tool: "refund_capture", args }, orders);

  it("refunds one named item from the last order as exactly that line", () => {
    expect(refund({ order: "last", items: [{ name: "horchata", quantity: 1 }] })).toEqual({
      ok: true,
      proposal: { id: "p", tool: "refund_capture", args: expect.objectContaining({ orderId: "6VU297505J010243X", n: 2, amountMinor: 300 }) },
    });
  });

  it("lets an explicit amount win over items", () => {
    const r = refund({ order: "2", items: [{ name: "Horchata" }], amount: 2.5 });
    expect(r.ok && r.proposal.args.amountMinor).toBe(250);
  });

  it("sums several items and caps quantities at what was bought", () => {
    const r = refund({ order: "#2", items: [{ name: "al pastor", quantity: 5 }, { name: "Horchata" }] });
    expect(r.ok && r.proposal.args.amountMinor).toBe(2100);
  });

  it("refuses an order that doesn't exist and says which ones do", () => {
    const r = refund({ order: "3", items: [{ name: "Horchata" }] });
    expect(r).toEqual({ ok: false, message: expect.stringContaining("the last order is 2") });
  });

  it("refuses an item that isn't on the order", () => {
    expect(refund({ order: "last", items: [{ name: "Churros" }] }).ok).toBe(false);
  });

  it("never proposes more than is left to refund", () => {
    const partly = orders.map((o) => (o.n === 2 ? { ...o, refundedMinor: 2000 } : o));
    expect(resolveOrderProposal({ id: "p", tool: "refund_capture", args: { order: "2", amount: 3 } }, partly).ok).toBe(false);
    const half = resolveOrderProposal({ id: "p", tool: "refund_capture", args: { order: "2", fraction: 0.5 } }, partly);
    expect(half.ok && half.proposal.args.amountMinor).toBe(100);
  });

  it("pins tracking to the real PayPal order id", () => {
    const r = resolveOrderProposal({ id: "p", tool: "add_tracking", args: { order: "the last order", trackingNumber: "1Z999AA10123456784", carrier: "UPS" } }, orders);
    expect(r.ok && r.proposal.args.orderId).toBe("6VU297505J010243X");
  });

  it("finds orders by number, #number, PayPal id or 'latest'", () => {
    expect(findOrder("order 1", orders)?.n).toBe(1);
    expect(findOrder("6vu297505j010243x", orders)?.n).toBe(2);
    expect(findOrder("latest", orders)?.n).toBe(2);
    expect(findOrder("9", orders)).toBeUndefined();
  });
});
