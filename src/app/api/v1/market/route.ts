import type { NextRequest } from "next/server";
import { z } from "zod";
import { ReceiptBook } from "@/core/receipts";
import { assertSameOrigin, fail, ok, parseJson, rateLimit } from "@/server/http";
import { channel3Configured, marketCheck } from "@/server/channel3";

const Body = z.object({
  currency: z.string().length(3),
  items: z.array(z.object({ id: z.string().max(40), query: z.string().min(2).max(120) })).max(10),
});

export async function POST(req: NextRequest) {
  const book = new ReceiptBook("market");
  try {
    assertSameOrigin(req);
    rateLimit(req, "market", 20);
    const body = await parseJson(req, Body);
    if (!channel3Configured()) return ok({ enabled: false, matches: {} });
    const matches = await marketCheck(body.items, body.currency, book);
    return ok({ enabled: true, matches }, book.items);
  } catch (err) {
    return fail(err, book.items);
  }
}
