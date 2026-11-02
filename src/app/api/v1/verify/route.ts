import type { NextRequest } from "next/server";
import { z } from "zod";
import { ReceiptBook } from "@/core/receipts";
import { verifyReceipt } from "@/core/signing";
import { verifyOrder } from "@/core/verify";
import { assertSameOrigin, fail, HttpError, ok, parseJson, rateLimit } from "@/server/http";
import { getOrder } from "@/server/paypal/ops";
import { PayPalError } from "@/server/paypal/client";
import { pickupCode } from "@/server/doorbell";
import { signingSecret, trustedStall } from "@/server/stall";

const Ids = z.array(z.string().max(40)).max(5000);

const Body = z.object({
  // Either a scanned receipt QR, or an order ID typed by the seller.
  code: z.string().max(200).optional(),
  orderId: z.string().regex(/^[A-Z0-9]{5,40}$/).optional(),
  // The seller's own stall (signed) and what this device already recorded, for replay protection.
  signed: z.string().max(8000),
  recorded: z.object({ orderIds: Ids, captureIds: Ids, recordedAt: z.record(z.string(), z.string()).optional() }),
});

export async function POST(req: NextRequest) {
  const book = new ReceiptBook("verify");
  try {
    assertSameOrigin(req);
    rateLimit(req, "verify", 40);
    const body = await parseJson(req, Body, 400_000);
    const stall = trustedStall(body.signed);

    let orderId = body.orderId;
    if (body.code) {
      const r = verifyReceipt(body.code, signingSecret());
      if (!r.ok) throw new HttpError(400, "RECEIPT_FORGED", "This QR isn't a Paperstall receipt, or it was altered.");
      if (r.stallId !== stall.id) throw new HttpError(400, "RECEIPT_OTHER_STALL", "This receipt is for a different stall.");
      orderId = r.orderId;
    }
    if (!orderId) throw new HttpError(400, "INVALID_INPUT", "Scan a receipt or type an order ID.");

    let order;
    try {
      order = await getOrder(orderId, { receipts: book });
    } catch (e) {
      if (e instanceof PayPalError && e.status === 404) {
        return ok({ verdict: { ok: false, reason: "not_paid", message: "No such PayPal order" } }, book.items);
      }
      throw e;
    }
    const verdict = verifyOrder(order, stall, body.recorded);
    // The pickup code and the payer's first name help the seller hand the order to the right person.
    const extra = verdict.ok ? { pickupCode: pickupCode(order.id, signingSecret()), payer: order.payer?.name?.given_name?.slice(0, 40) } : {};
    return ok({ verdict, ...extra }, book.items);
  } catch (err) {
    return fail(err, book.items);
  }
}
