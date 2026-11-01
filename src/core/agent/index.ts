// Penny's tools and the approval gate. Tools that move money or contact a customer
// return a proposal; only an explicit seller approval (in the UI) executes them.

import { z } from "zod";

export type ToolEffect = "read" | "mutate";

export const TOOLS = {
  list_unpaid_invoices: { effect: "read", description: "List this seller's invoices that are not paid yet.", args: z.object({}) },
  get_invoice: { effect: "read", description: "Get the live PayPal status of one invoice.", args: z.object({ invoiceId: z.string().max(40) }) },
  get_order: { effect: "read", description: "Get the live PayPal status of one order (also used to check a payment).", args: z.object({ orderId: z.string().max(40) }) },
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
      "Propose a refund of a ledger order. order = the ledger number (\"3\") or PayPal order id. Use fraction for parts (half = 0.5) or amount in the order currency; omit both for a full refund.",
    args: z.object({
      order: z.string().max(40),
      fraction: z.number().gt(0).max(1).optional(),
      amount: z.number().positive().optional(),
      reason: z.string().max(200).optional(),
    }),
  },
  add_tracking: {
    effect: "mutate",
    description: "Propose adding shipment tracking to a ledger order. order = the ledger number or PayPal order id.",
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

/** Function declarations for Gemini, from the zod schemas. */
export function functionDeclarations() {
  return (Object.keys(TOOLS) as ToolName[]).map((name) => {
    const schema = z.toJSONSchema(TOOLS[name].args) as Record<string, unknown>;
    return { name, description: TOOLS[name].description, parametersJsonSchema: schema };
  });
}
