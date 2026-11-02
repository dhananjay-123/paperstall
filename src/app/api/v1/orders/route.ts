import type { NextRequest } from "next/server";
import { z } from "zod";
import { toPayPalValue } from "@/core/money";
import { ReceiptBook } from "@/core/receipts";
import { Cart, priceCart } from "@/core/stall";
import { assertSameOrigin, fail, HttpError, ok, parseJson, rateLimit } from "@/server/http";
import { createOrder } from "@/server/paypal/ops";
import { trustedStall } from "@/server/stall";

const Body = z.object({
  signed: z.string().max(8000),
  cart: Cart,
  // Buyer notes from the concierge ("one with oat milk"), kept short; data only.
  notes: z.record(z.string().max(24), z.string().max(100)).optional(),
});

export async function POST(req: NextRequest) {
  const book = new ReceiptBook("checkout");
  try {
    assertSameOrigin(req);
    rateLimit(req, "orders", 20);
    const body = await parseJson(req, Body);
    const stall = trustedStall(body.signed);
    let priced;
    try {
      priced = priceCart(stall, body.cart);
    } catch {
      throw new HttpError(400, "BAD_CART", "Something in the cart isn't on this stall any more. Refresh the page.");
    }
    const order = await createOrder(
      {
        currency: priced.currency,
        itemTotal: priced.itemTotal,
        ...(priced.taxMinor > 0 ? { taxTotal: priced.taxTotal, total: priced.total } : {}),
        payeeEmail: stall.p,
        customId: stall.id,
        invoiceId: `ps-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
        description: stall.n,
        lines: priced.lines.map((l) => ({
          name: l.item.name,
          quantity: l.qty,
          unitValue: toPayPalValue(l.item.price, priced.currency),
          sku: l.item.id, // verify maps lines back to stall items by sku
          description: body.notes?.[l.item.id],
        })),
      },
      { receipts: book },
    );
    return ok({ orderId: order.id }, book.items);
  } catch (err) {
    return fail(err, book.items);
  }
}
