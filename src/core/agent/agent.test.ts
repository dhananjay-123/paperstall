import { describe, expect, it, vi } from "vitest";
import { runTool, TOOLS, type ReadExecutors } from "./index";

function readers(): ReadExecutors {
  return {
    list_unpaid_invoices: vi.fn(async () => []),
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
