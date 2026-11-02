import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { ReceiptBook } from "@/core/receipts";
import { signReceipt } from "@/core/signing";
import { verifyOrder } from "@/core/verify";
import { assertSameOrigin, fail, HttpError, ok, parseJson, rateLimit } from "@/server/http";
import { captureOrder, getOrder } from "@/server/paypal/ops";
import { PayPalError } from "@/server/paypal/client";
import { openTopic, pickupCode, ring } from "@/server/doorbell";
import { signingSecret, trustedStall } from "@/server/stall";

const Body = z.object({ signed: z.string().max(8000), orderId: z.string().regex(/^[A-Z0-9]{5,40}$/) });

export async function POST(req: NextRequest) {
  const book = new ReceiptBook("checkout");
  try {
    assertSameOrigin(req);
    rateLimit(req, "capture", 20);
    const { signed, orderId } = await parseJson(req, Body);
    const stall = trustedStall(signed);

    let order;
    try {
      order = await captureOrder(orderId, { receipts: book, requestId: `capture-${orderId}` });
    } catch (e) {
      // A double-click or retry after a timeout: the order is already captured, so read it instead.
      if (e instanceof PayPalError && e.issue === "ORDER_ALREADY_CAPTURED") order = await getOrder(orderId, { receipts: book });
      else throw e;
    }

    // Same checks the seller's scanner runs, so the buyer sees the truth too.
    const verdict = verifyOrder(order, stall);
    if (!verdict.ok) throw new HttpError(409, `ORDER_${verdict.reason.toUpperCase()}`, `${verdict.message}. Order ${order.id}.`);
    // Ring the seller's counter after responding. It re-checks with PayPal itself.
    const topic = stall.nt ? openTopic(stall.nt, signingSecret()) : null;
    if (topic) after(() => ring(topic, { t: "paid", o: order.id }));
    return ok(
      { ...verdict, stallId: stall.id, stallName: stall.n, receiptCode: signReceipt(order.id, stall.id, signingSecret()), pickupCode: pickupCode(order.id, signingSecret()) },
      book.items,
    );
  } catch (err) {
    return fail(err, book.items);
  }
}
