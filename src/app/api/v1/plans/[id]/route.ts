import type { NextRequest } from "next/server";
import { z } from "zod";
import { fromPayPalValue, isPayPalCurrency } from "@/core/money";
import { ReceiptBook } from "@/core/receipts";
import { fail, ok, rateLimit } from "@/server/http";
import { paypal } from "@/server/paypal/client";

type PlanDetail = {
  id: string;
  name: string;
  description?: string;
  status: string;
  billing_cycles: { tenure_type: string; total_cycles?: number; frequency: { interval_unit: string }; pricing_scheme?: { fixed_price?: { currency_code: string; value: string } } }[];
};

/** Public plan details for the subscribe page; the price shown comes from PayPal, not the URL. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/plans/[id]">) {
  const book = new ReceiptBook("plan-get");
  try {
    rateLimit(req, "plan-get", 60);
    const id = z.string().regex(/^P-[A-Z0-9]{10,40}$/).parse((await ctx.params).id);
    const plan = await paypal<PlanDetail>("GET", `/v1/billing/plans/${id}`, { receipts: book, note: "get plan" });
    const regular = plan.billing_cycles.find((c) => c.tenure_type === "REGULAR");
    const trial = plan.billing_cycles.find((c) => c.tenure_type === "TRIAL");
    const price = regular?.pricing_scheme?.fixed_price;
    return ok(
      {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        status: plan.status,
        currency: price?.currency_code,
        priceMinor: price && isPayPalCurrency(price.currency_code) ? fromPayPalValue(price.value, price.currency_code) : undefined,
        interval: regular?.frequency.interval_unit.toLowerCase(),
        trialCycles: trial?.total_cycles ?? 0,
      },
      book.items,
    );
  } catch (err) {
    return fail(err, book.items);
  }
}
