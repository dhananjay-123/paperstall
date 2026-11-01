// PayPal order + stall → Verdict. A sale enters the ledger only on a pass (ADR-003).
// Pure and framework-free so a POS or another platform can run the same rules.

import { fromPayPalValue, isPayPalCurrency, type CurrencyCode } from "../money";
import type { StallPayload } from "../stall";

export type VerdictReason =
  | "not_paid"
  | "wrong_payee"
  | "amount_mismatch"
  | "currency_mismatch"
  | "wrong_stall"
  | "already_recorded";

/** The parts of a PayPal order we check (Orders v2 GET response). */
export type OrderFacts = {
  id: string;
  status: string;
  purchase_units: {
    custom_id?: string;
    amount: { currency_code: string; value: string };
    payee?: { email_address?: string };
    items?: { name: string; quantity: string; unit_amount: { currency_code: string; value: string }; sku?: string }[];
    payments?: { captures?: { id: string; status: string; amount: { currency_code: string; value: string }; create_time?: string }[] };
  }[];
};

export type Recorded = { orderIds: string[]; captureIds: string[]; recordedAt?: Record<string, string> };

export type PassedVerdict = {
  ok: true;
  orderId: string;
  captureId: string;
  currency: CurrencyCode;
  totalMinor: number;
  items: { id: string; name: string; quantity: number }[];
  paidAt?: string;
};

export type FailedVerdict = { ok: false; reason: VerdictReason; message: string; recordedAt?: string };

export type Verdict = PassedVerdict | FailedVerdict;

const MESSAGES: Record<VerdictReason, string> = {
  not_paid: "Not paid yet",
  wrong_payee: "Paid to someone else",
  amount_mismatch: "Amount doesn't match",
  currency_mismatch: "Currency doesn't match",
  wrong_stall: "This order isn't from your stall",
  already_recorded: "Already recorded",
};

const fail = (reason: VerdictReason, extra: Partial<FailedVerdict> = {}): FailedVerdict => ({ ok: false, reason, message: MESSAGES[reason], ...extra });

export function verifyOrder(order: OrderFacts, stall: StallPayload, recorded: Recorded = { orderIds: [], captureIds: [] }): Verdict {
  const pu = order.purchase_units?.[0];
  if (!pu) return fail("not_paid");

  // Replay first: a re-scanned receipt must say "already recorded", not look like a new sale.
  const capture = pu.payments?.captures?.[0];
  if (recorded.orderIds.includes(order.id) || (capture && recorded.captureIds.includes(capture.id))) {
    return fail("already_recorded", { recordedAt: recorded.recordedAt?.[order.id] });
  }

  if (pu.custom_id !== stall.id) return fail("wrong_stall");
  if (order.status !== "COMPLETED" || !capture || capture.status !== "COMPLETED") return fail("not_paid");

  const payee = pu.payee?.email_address?.toLowerCase();
  if (!payee || payee !== stall.p.toLowerCase()) return fail("wrong_payee");

  const currency = stall.c as CurrencyCode;
  if (pu.amount.currency_code !== currency || capture.amount.currency_code !== currency || !isPayPalCurrency(currency)) return fail("currency_mismatch");

  // Recompute from the stall's own prices; the order's numbers must agree exactly.
  const byId = new Map(stall.i.map((i) => [i.id, i]));
  let expected = 0;
  const items: PassedVerdict["items"] = [];
  for (const line of pu.items ?? []) {
    const item = line.sku ? byId.get(line.sku) : undefined;
    const qty = Number(line.quantity);
    if (!item || !Number.isInteger(qty) || qty < 1) return fail("amount_mismatch");
    if (fromPayPalValue(line.unit_amount.value, currency) !== item.price) return fail("amount_mismatch");
    expected += item.price * qty;
    items.push({ id: item.id, name: item.name, quantity: qty });
  }
  const captured = fromPayPalValue(capture.amount.value, currency);
  const orderTotal = fromPayPalValue(pu.amount.value, currency);
  if (!items.length || expected !== orderTotal || captured !== expected) return fail("amount_mismatch");

  return { ok: true, orderId: order.id, captureId: capture.id, currency, totalMinor: expected, items, paidAt: capture.create_time };
}
