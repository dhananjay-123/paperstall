import type { NextRequest } from "next/server";
import { z } from "zod";
import { isPayPalCurrency, toPayPalValue, type CurrencyCode } from "@/core/money";
import { ReceiptBook } from "@/core/receipts";
import { assertSameOrigin, fail, ok, parseJson, rateLimit } from "@/server/http";
import { createPlan, createProduct } from "@/server/paypal/ops";

const Body = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(120).optional(),
  currency: z.string().refine(isPayPalCurrency, "Unsupported currency"),
  priceMinor: z.number().int().positive(),
  interval: z.enum(["week", "month", "year"]),
  trialCycles: z.number().int().min(0).max(3).optional(),
});

const UNIT = { week: "WEEK", month: "MONTH", year: "YEAR" } as const;

/** Catalog Product + active Billing Plan in one step. */
export async function POST(req: NextRequest) {
  const book = new ReceiptBook("plan");
  try {
    assertSameOrigin(req);
    rateLimit(req, "plans", 10);
    const b = await parseJson(req, Body);
    const product = await createProduct({ name: b.name, description: b.description, type: "SERVICE" }, { receipts: book });
    const plan = await createPlan(
      {
        productId: product.id,
        name: b.name,
        description: b.description,
        currency: b.currency,
        value: toPayPalValue(b.priceMinor, b.currency as CurrencyCode),
        interval: UNIT[b.interval],
        trialCycles: b.trialCycles || undefined,
      },
      { receipts: book },
    );
    return ok({ productId: product.id, planId: plan.id, status: plan.status }, book.items);
  } catch (err) {
    return fail(err, book.items);
  }
}
