import type { NextRequest } from "next/server";
import { z } from "zod";
import { fromPayPalValue, isPayPalCurrency, toPayPalValue } from "@/core/money";
import { ReceiptBook } from "@/core/receipts";
import { assertSameOrigin, fail, HttpError, ok, parseJson, rateLimit } from "@/server/http";
import { addTracking, getOrder, refundCapture } from "@/server/paypal/ops";
import { assertOwner } from "@/server/stall";

const OrderId = z.string().regex(/^[A-Z0-9]{5,40}$/);

// Every action names the seller's stall and carries its owner token (from /stalls/sign).
const Owned = { stallId: z.string().uuid(), owner: z.string().max(40) };

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("refund"), ...Owned, captureId: z.string().regex(/^[A-Z0-9]{5,40}$/), amountMinor: z.number().int().positive().optional(), note: z.string().max(255).optional() }),
  z.object({ action: z.literal("track"), ...Owned, captureId: z.string().regex(/^[A-Z0-9]{5,40}$/), trackingNumber: z.string().min(3).max(64), carrier: z.string().min(2).max(64), carrierNameOther: z.string().max(64).optional() }),
]);

/** Order status for the ledger and Penny's get_order. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/orders/[id]">) {
  const book = new ReceiptBook("order-get");
  try {
    rateLimit(req, "order-get", 60);
    const id = OrderId.parse((await ctx.params).id);
    const o = await getOrder(id, { receipts: book });
    const pu = o.purchase_units[0];
    const cap = pu?.payments?.captures?.[0];
    return ok({ id: o.id, status: o.status, captureId: cap?.id, captureStatus: cap?.status, amount: pu?.amount, payee: pu?.payee?.email_address, stallId: pu?.custom_id }, book.items);
  } catch (err) {
    return fail(err, book.items);
  }
}

/** Refund / add tracking. Called only after the seller approves an Approval Card. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/v1/orders/[id]">) {
  const book = new ReceiptBook("order-action");
  try {
    assertSameOrigin(req);
    rateLimit(req, "order-action", 10);
    const orderId = OrderId.parse((await ctx.params).id);
    const body = await parseJson(req, Body);
    assertOwner("stall", body.stallId, body.owner);

    // The order must belong to that stall, and the capture to that order.
    const order = await getOrder(orderId, { receipts: book });
    const pu = order.purchase_units[0];
    if (pu?.custom_id !== body.stallId) throw new HttpError(403, "NOT_YOUR_ORDER", "This order wasn't paid at your stall.");
    const cap = pu.payments?.captures?.find((c) => c.id === body.captureId);
    if (!cap) throw new HttpError(400, "CAPTURE_NOT_IN_ORDER", "That payment isn't part of this order.");

    if (body.action === "refund") {
      const c = cap.amount.currency_code;
      if (!isPayPalCurrency(c)) throw new HttpError(400, "BAD_CURRENCY", "Unsupported currency.");
      const captured = fromPayPalValue(cap.amount.value, c);
      // Never refund more than was captured; PayPal also tracks earlier partial refunds.
      if (body.amountMinor && body.amountMinor > captured) throw new HttpError(400, "REFUND_TOO_LARGE", "That's more than the customer paid.");
      const refund = await refundCapture(
        body.captureId,
        { amount: body.amountMinor ? { currency_code: c, value: toPayPalValue(body.amountMinor, c) } : undefined, noteToPayer: body.note },
        { receipts: book, requestId: `refund-${body.captureId}-${body.amountMinor ?? "full"}` },
      );
      return ok({ refundId: refund.id, status: refund.status, refundedMinor: body.amountMinor ?? captured, currency: c }, book.items);
    }

    const tracked = await addTracking(
      orderId,
      { captureId: body.captureId, trackingNumber: body.trackingNumber, carrier: body.carrier.toUpperCase(), carrierNameOther: body.carrierNameOther },
      { receipts: book },
    );
    return ok({ orderId: tracked.id, status: tracked.status }, book.items);
  } catch (err) {
    return fail(err, book.items);
  }
}
