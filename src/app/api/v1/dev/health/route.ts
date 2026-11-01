import type { NextRequest } from "next/server";
import { ReceiptBook } from "@/core/receipts";
import { env } from "@/lib/env";
import { fail, HttpError, ok } from "@/server/http";
import { captureOrder, createDraftInvoice, createOrder, deleteInvoice, getOrder } from "@/server/paypal/ops";

// Dev-only plumbing check. Creates a real $1 sandbox order (capture needs a buyer approval,
// which the /dev/health page does through the approval link) and a draft invoice it deletes again.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return fail(new HttpError(404, "NOT_FOUND", "Not found"));
  const book = new ReceiptBook("dev-health");
  const step = new URL(req.url).searchParams.get("step") ?? "order";
  try {
    if (step === "order") {
      const payee = env.PAYPAL_DEMO_PAYEE_EMAIL;
      if (!payee) throw new HttpError(503, "NOT_CONFIGURED", "Set PAYPAL_DEMO_PAYEE_EMAIL in .env.local.");
      const origin = new URL(req.url).origin;
      const order = await createOrder(
        {
          currency: "USD",
          itemTotal: "1.00",
          lines: [{ name: "Health check", quantity: 1, unitValue: "1.00" }],
          payeeEmail: payee,
          customId: "dev-health",
          invoiceId: `health-${crypto.randomUUID()}`,
          returnUrl: `${origin}/dev/health?return=1`,
          cancelUrl: `${origin}/dev/health?cancel=1`,
        },
        { receipts: book },
      );
      const approve = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
      return ok({ orderId: order.id, status: order.status, approveUrl: approve }, book.items);
    }
    if (step === "check") {
      const id = new URL(req.url).searchParams.get("orderId");
      if (!id) throw new HttpError(400, "INVALID_INPUT", "orderId is required");
      const order = await getOrder(id, { receipts: book });
      return ok({ orderId: order.id, status: order.status }, book.items);
    }
    if (step === "capture") {
      const id = new URL(req.url).searchParams.get("orderId");
      if (!id) throw new HttpError(400, "INVALID_INPUT", "orderId is required");
      const order = await captureOrder(id, { receipts: book });
      const cap = order.purchase_units[0]?.payments?.captures?.[0];
      return ok({ orderId: order.id, status: order.status, captureId: cap?.id, captureStatus: cap?.status }, book.items);
    }
    if (step === "invoice") {
      const draft = await createDraftInvoice(
        {
          currency: "USD",
          invoicerEmail: env.PAYPAL_DEMO_PAYEE_EMAIL,
          recipient: { email: "health-check@example.com", givenName: "Health", surname: "Check" },
          items: [{ name: "Health check", quantity: 1, unitValue: "1.00" }],
          note: "Paperstall plumbing check (deleted immediately).",
        },
        { receipts: book },
      );
      await deleteInvoice(draft.id, { receipts: book });
      return ok({ invoiceId: draft.id, created: true, deleted: true }, book.items);
    }
    throw new HttpError(400, "INVALID_INPUT", "Unknown step");
  } catch (err) {
    return fail(err, book.items);
  }
}
