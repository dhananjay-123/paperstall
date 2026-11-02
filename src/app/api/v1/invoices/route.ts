import type { NextRequest } from "next/server";
import { z } from "zod";
import { fromPayPalValue, isPayPalCurrency, toPayPalValue, type CurrencyCode } from "@/core/money";
import { ReceiptBook } from "@/core/receipts";
import { assertSameOrigin, fail, HttpError, ok, parseJson, rateLimit } from "@/server/http";
import { ownerToken } from "@/core/signing";
import { createDraftInvoice, invoiceQrPng, sendInvoice } from "@/server/paypal/ops";
import { signingSecret } from "@/server/stall";

const Body = z.object({
  currency: z.string().refine(isPayPalCurrency, "Unsupported currency"),
  businessName: z.string().max(120).optional(),
  recipient: z.object({
    email: z.email().max(254),
    givenName: z.string().max(60).optional(),
    surname: z.string().max(60).optional(),
    businessName: z.string().max(120).optional(),
  }),
  items: z
    .array(z.object({ name: z.string().min(1).max(200), quantity: z.number().int().min(1).max(100000), unitMinor: z.number().int().positive() }))
    .min(1)
    .max(100),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  memo: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
});

/**
 * Creates the draft, sends it and generates its QR. The seller already approved the
 * side-by-side preview; this is the one call that contacts the customer.
 */
export async function POST(req: NextRequest) {
  const book = new ReceiptBook("invoice");
  try {
    assertSameOrigin(req);
    rateLimit(req, "invoices", 10);
    const b = await parseJson(req, Body);
    const currency = b.currency as CurrencyCode;
    const expectedMinor = b.items.reduce((n, i) => n + i.unitMinor * i.quantity, 0);
    const draft = await createDraftInvoice(
      {
        currency,
        invoicerBusinessName: b.businessName,
        recipient: b.recipient,
        dueDate: b.dueDate,
        termType: b.dueDate ? undefined : "DUE_ON_RECEIPT",
        memo: b.memo,
        note: b.note,
        items: b.items.map((i) => ({ name: i.name, quantity: i.quantity, unitValue: toPayPalValue(i.unitMinor, currency) })),
      },
      { receipts: book },
    );
    // PayPal computes the total; it must equal ours before anything goes to the customer.
    const paypalTotal = draft.amount?.value ? fromPayPalValue(draft.amount.value, currency) : expectedMinor;
    if (paypalTotal !== expectedMinor) throw new HttpError(409, "INVOICE_TOTAL_MISMATCH", "PayPal's total didn't match ours, so the invoice wasn't sent.");

    const sent = await sendInvoice(draft.id, {}, { receipts: book });
    let qrPng: string | undefined;
    try {
      qrPng = await invoiceQrPng(draft.id, { receipts: book });
    } catch {
      // The invoice is sent either way; the share page can retry the QR.
    }
    return ok(
      {
        id: draft.id,
        number: draft.detail.invoice_number,
        status: "SENT",
        totalMinor: expectedMinor,
        payerUrl: sent?.href ?? draft.detail.metadata?.recipient_view_url,
        qrPng,
        // Remind and cancel need this; the invoice ID alone is public (it's in the share link).
        owner: ownerToken("invoice", draft.id, signingSecret()),
      },
      book.items,
    );
  } catch (err) {
    return fail(err, book.items);
  }
}
