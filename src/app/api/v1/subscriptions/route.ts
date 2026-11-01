import type { NextRequest } from "next/server";
import { z } from "zod";
import { ReceiptBook } from "@/core/receipts";
import { assertSameOrigin, fail, ok, parseJson, rateLimit } from "@/server/http";
import { createSubscription, getSubscription } from "@/server/paypal/ops";

const PlanId = z.string().regex(/^P-[A-Z0-9]{10,40}$/);
const SubId = z.string().regex(/^I-[A-Z0-9]{8,40}$/);

const Body = z.union([z.object({ planId: PlanId, brandName: z.string().max(120).optional() }), z.object({ subscriptionId: SubId })]);

/** { planId } → creates a subscription for the buyer to approve. { subscriptionId } → its status. */
export async function POST(req: NextRequest) {
  const book = new ReceiptBook("subscription");
  try {
    assertSameOrigin(req);
    rateLimit(req, "subscriptions", 20);
    const body = await parseJson(req, Body);
    if ("planId" in body) {
      const origin = new URL(req.url).origin;
      const sub = await createSubscription(
        { planId: body.planId, brandName: body.brandName, returnUrl: `${origin}/sub/${body.planId}?done=1`, cancelUrl: `${origin}/sub/${body.planId}` },
        { receipts: book },
      );
      return ok({ subscriptionId: sub.id, status: sub.status }, book.items);
    }
    const sub = await getSubscription(body.subscriptionId, { receipts: book });
    return ok(
      {
        subscriptionId: sub.id,
        planId: sub.plan_id,
        status: sub.status,
        startTime: sub.start_time,
        lastPayment: sub.billing_info?.last_payment,
        nextBilling: sub.billing_info?.next_billing_time,
      },
      book.items,
    );
  } catch (err) {
    return fail(err, book.items);
  }
}
