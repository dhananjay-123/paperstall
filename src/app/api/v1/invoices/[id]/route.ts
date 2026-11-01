import type { NextRequest } from "next/server";
import { z } from "zod";
import { fromPayPalValue, isPayPalCurrency } from "@/core/money";
import { ReceiptBook } from "@/core/receipts";
import { assertSameOrigin, fail, HttpError, ok, parseJson, rateLimit } from "@/server/http";
import { cancelInvoice, getInvoice, invoiceQrPng, remindInvoice } from "@/server/paypal/ops";

const Id = z.string().regex(/^INV2(-[A-Z0-9]{4}){4}$/);

function summary(inv: Awaited<ReturnType<typeof getInvoice>>) {
  const c = inv.detail.currency_code;
  const minor = (v?: string) => (v && isPayPalCurrency(c) ? fromPayPalValue(v, c) : undefined);
  return {
    id: inv.id,
    number: inv.detail.invoice_number,
    status: inv.status,
    currency: c,
    totalMinor: minor(inv.amount?.value),
    paidMinor: minor(inv.payments?.paid_amount?.value),
    dueDate: inv.detail.payment_term?.due_date,
    payerUrl: inv.detail.metadata?.recipient_view_url,
    items: (inv.items ?? []).map((i) => ({ name: i.name, quantity: Number(i.quantity), unitMinor: minor(i.unit_amount.value) ?? 0 })),
  };
}

/** Public status for the invoice share page. Knowing the ID is the capability, as with PayPal's own payer link. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/invoices/[id]">) {
  const book = new ReceiptBook("invoice-status");
  try {
    rateLimit(req, "invoice-get", 60);
    const id = Id.parse((await ctx.params).id);
    const inv = await getInvoice(id, { receipts: book });
    const withQr = new URL(req.url).searchParams.get("qr") === "1";
    let qrPng: string | undefined;
    if (withQr && !["PAID", "MARKED_AS_PAID", "CANCELLED", "DRAFT"].includes(inv.status)) {
      qrPng = await invoiceQrPng(id, { receipts: book }).catch(() => undefined);
    }
    return ok({ ...summary(inv), qrPng }, book.items);
  } catch (err) {
    return fail(err, book.items);
  }
}

const Action = z.object({ action: z.enum(["remind", "cancel"]), note: z.string().max(500).optional() });

/** Remind / cancel. Called only after the seller approves (UI button or a Penny approval card). */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/v1/invoices/[id]">) {
  const book = new ReceiptBook("invoice-action");
  try {
    assertSameOrigin(req);
    rateLimit(req, "invoice-action", 10);
    const id = Id.parse((await ctx.params).id);
    const { action, note } = await parseJson(req, Action);
    if (action === "remind") await remindInvoice(id, note ? { note } : {}, { receipts: book });
    else await cancelInvoice(id, note ? { note } : {}, { receipts: book });
    const inv = await getInvoice(id, { receipts: book });
    if (action === "cancel" && inv.status !== "CANCELLED") throw new HttpError(409, "NOT_CANCELLED", `PayPal reports the invoice as ${inv.status}.`);
    return ok(summary(inv), book.items);
  } catch (err) {
    return fail(err, book.items);
  }
}
