// Penny's tools and the approval gate. Tools that move money or contact a customer
// return a proposal; only an explicit seller approval (in the UI) executes them.

import { z } from "zod";
import { formatMoney, isPayPalCurrency, toMinor } from "@/core/money";

export type ToolEffect = "read" | "mutate";

export const TOOLS = {
  list_unpaid_invoices: { effect: "read", description: "List this seller's invoices that are not paid yet.", args: z.object({}) },
  get_invoice: { effect: "read", description: "Get the live PayPal status of one invoice.", args: z.object({ invoiceId: z.string().max(40) }) },
  get_order: { effect: "read", description: "Get the live PayPal status of one order (also used to check a payment).", args: z.object({ orderId: z.string().max(40) }) },
  list_orders: {
    effect: "read",
    description: "List recent ledger orders, newest first, with their number, PayPal order id, line items (name, quantity, unit price) and what's still refundable.",
    args: z.object({ limit: z.number().int().min(1).max(20).optional() }),
  },
  sales_summary: {
    effect: "read",
    description: "Sum verified sales from the local ledger for a period.",
    args: z.object({ period: z.enum(["today", "week", "month", "all"]) }),
  },
  check_market_price: {
    effect: "read",
    description: "Look up the market price range for a branded product (Channel3).",
    args: z.object({ itemName: z.string().min(2).max(120) }),
  },
  send_invoice_reminder: {
    effect: "mutate",
    description: "Propose a polite payment reminder for an unpaid invoice.",
    args: z.object({ invoiceId: z.string().max(40), note: z.string().max(400).optional() }),
  },
  cancel_invoice: { effect: "mutate", description: "Propose cancelling a sent invoice.", args: z.object({ invoiceId: z.string().max(40), note: z.string().max(400).optional() }) },
  refund_capture: {
    effect: "mutate",
    description:
      "Propose a refund of a ledger order. order = the ledger number (\"3\"), \"last\" or the PayPal order id. For named items (\"one horchata\") pass items: the refund is the sum of those lines. Use amount only for a money amount the seller states (it wins), fraction for parts (half = 0.5); omit all three for a full refund.",
    args: z.object({
      order: z.string().max(40),
      items: z.array(z.object({ name: z.string().max(120), quantity: z.number().int().min(1).max(999).optional() })).max(30).optional(),
      fraction: z.number().gt(0).max(1).optional(),
      amount: z.number().positive().optional(),
      reason: z.string().max(200).optional(),
    }),
  },
  add_tracking: {
    effect: "mutate",
    description: "Propose adding shipment tracking to a ledger order. order = the ledger number (\"3\"), \"last\" or the PayPal order id.",
    args: z.object({ order: z.string().max(40), trackingNumber: z.string().min(3).max(64), carrier: z.string().min(2).max(64) }),
  },
  create_invoice_from_text: {
    effect: "mutate",
    description: "Propose a new PayPal invoice from the seller's words.",
    args: z.object({
      customerName: z.string().max(120),
      customerEmail: z.string().max(254).optional(),
      items: z.array(z.object({ name: z.string().max(200), quantity: z.number().int().min(1), unitPrice: z.number().positive() })).min(1).max(30),
      dueDate: z.string().max(10).optional().describe("YYYY-MM-DD"),
      currency: z.string().length(3).optional(),
    }),
  },
  create_payment_link_for_items: {
    effect: "mutate",
    description: "Propose a one-item payment link (a tiny stall) for something not on the board.",
    args: z.object({ name: z.string().max(80), price: z.number().positive(), currency: z.string().length(3).optional() }),
  },
} as const satisfies Record<string, { effect: ToolEffect; description: string; args: z.ZodType }>;

export type ToolName = keyof typeof TOOLS;
export type ToolArgs<N extends ToolName> = z.infer<(typeof TOOLS)[N]["args"]>;

export type AgentProposal = { id: string; tool: ToolName; args: Record<string, unknown> };

export type ToolOutcome =
  | { kind: "result"; tool: ToolName; data: unknown }
  | { kind: "proposal"; tool: ToolName; proposal: AgentProposal }
  | { kind: "error"; tool: string; message: string };

export type ReadExecutors = { [N in ToolName as (typeof TOOLS)[N]["effect"] extends "read" ? N : never]: (args: ToolArgs<N>) => Promise<unknown> };

export const isToolName = (n: string): n is ToolName => Object.hasOwn(TOOLS, n);

/**
 * The gate. Read tools run; mutating tools are turned into proposals and never executed here.
 * There is deliberately no executor for mutating tools in this module.
 */
export async function runTool(name: string, rawArgs: unknown, readers: ReadExecutors, makeId: () => string = () => crypto.randomUUID()): Promise<ToolOutcome> {
  if (!isToolName(name)) return { kind: "error", tool: name, message: "Unknown tool" };
  const def = TOOLS[name];
  const parsed = def.args.safeParse(rawArgs ?? {});
  if (!parsed.success) return { kind: "error", tool: name, message: `Invalid arguments: ${parsed.error.issues[0]?.message ?? "bad input"}` };
  if (def.effect === "mutate") {
    return { kind: "proposal", tool: name, proposal: { id: makeId(), tool: name, args: parsed.data as Record<string, unknown> } };
  }
  try {
    const exec = readers[name as keyof ReadExecutors] as (a: unknown) => Promise<unknown>;
    return { kind: "result", tool: name, data: await exec(parsed.data) };
  } catch (e) {
    return { kind: "error", tool: name, message: e instanceof Error ? e.message : "Tool failed" };
  }
}

export const MAX_TOOL_STEPS = 5;

/** A ledger order as the studio sends it to Penny. n is the seller's "order 3". */
export type PennyOrder = {
  n: number;
  id: string;
  at: string;
  customer?: string;
  lines: { name: string; quantity: number; unitMinor?: number }[];
  totalMinor: number;
  refundedMinor: number;
  currency: string;
  captured: boolean;
};

/** "last", "the latest order", "#3", "order 3", "3" or a PayPal order id → the ledger order. */
export function findOrder(ref: string, orders: PennyOrder[]): PennyOrder | undefined {
  const r = ref.trim().toLowerCase();
  if (!orders.length) return undefined;
  if (/^(the )?(last|latest|most recent|newest)( order)?$/.test(r)) return orders.reduce((a, b) => (b.n > a.n ? b : a));
  const n = /^(?:order\s*)?#?\s*(\d{1,6})$/.exec(r);
  if (n) return orders.find((o) => o.n === Number(n[1]));
  return orders.find((o) => o.id.toLowerCase() === r);
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Pins a refund or tracking proposal to a real order before the seller sees it, and works out a
 * refund from named items. Penny's words are never trusted for which order or how much.
 */
export function resolveOrderProposal(p: AgentProposal, orders: PennyOrder[]): { ok: true; proposal: AgentProposal } | { ok: false; message: string } {
  if (p.tool !== "refund_capture" && p.tool !== "add_tracking") return { ok: true, proposal: p };
  const a = p.args as Partial<ToolArgs<"refund_capture">>;
  const last = orders.length ? Math.max(...orders.map((o) => o.n)) : 0;
  const o = findOrder(String(a.order ?? ""), orders);
  if (!o) {
    return { ok: false, message: last ? `There is no order "${a.order}". Orders are numbered 1–${last}; the last order is ${last}. Use list_orders.` : "There are no orders in the ledger yet." };
  }
  if (!o.captured) return { ok: false, message: `Order ${o.n} has no PayPal capture, so it can't be refunded or shipped.` };
  const pinned = { orderId: o.id, n: o.n };
  if (p.tool === "add_tracking") return { ok: true, proposal: { ...p, args: { ...p.args, ...pinned } } };

  const cur = isPayPalCurrency(o.currency) ? o.currency : "USD";
  const remaining = o.totalMinor - o.refundedMinor;
  if (remaining <= 0) return { ok: false, message: `Order ${o.n} is already fully refunded.` };
  let amountMinor: number;
  if (typeof a.amount === "number") {
    amountMinor = toMinor(a.amount, cur);
  } else if (a.items?.length) {
    amountMinor = 0;
    for (const want of a.items) {
      const w = norm(want.name);
      const line = o.lines.find((l) => norm(l.name) === w) ?? o.lines.find((l) => norm(l.name).includes(w) || w.includes(norm(l.name)));
      if (!line) return { ok: false, message: `Order ${o.n} has no "${want.name}". It has ${o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}.` };
      if (line.unitMinor === undefined) return { ok: false, message: `The price of ${line.name} on order ${o.n} isn't known; ask the seller for an amount.` };
      amountMinor += line.unitMinor * Math.min(want.quantity ?? 1, line.quantity);
    }
  } else if (typeof a.fraction === "number") {
    amountMinor = Math.min(remaining, Math.round(o.totalMinor * a.fraction));
  } else {
    amountMinor = remaining;
  }
  if (!(amountMinor > 0)) return { ok: false, message: "The refund must be more than zero." };
  if (amountMinor > remaining) return { ok: false, message: `Order ${o.n} has only ${formatMoney(remaining, cur)} left to refund.` };
  return { ok: true, proposal: { ...p, args: { ...p.args, ...pinned, amountMinor } } };
}

/** Function declarations for Gemini, from the zod schemas. */
export function functionDeclarations() {
  return (Object.keys(TOOLS) as ToolName[]).map((name) => {
    const schema = z.toJSONSchema(TOOLS[name].args) as Record<string, unknown>;
    return { name, description: TOOLS[name].description, parametersJsonSchema: schema };
  });
}
