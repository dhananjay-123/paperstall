import type { NextRequest } from "next/server";
import { z } from "zod";
import { ReceiptBook } from "@/core/receipts";
import { assertSameOrigin, fail, ok, parseJson, rateLimit } from "@/server/http";
import { aupCheck, decodeImage, readPaper } from "@/server/read";

export const maxDuration = 60;

const Body = z.object({ image: z.string().min(100), hint: z.string().max(200).optional() });

export async function POST(req: NextRequest) {
  const book = new ReceiptBook("read");
  try {
    assertSameOrigin(req);
    rateLimit(req, "ai-read", 8);
    const body = await parseJson(req, Body, 6_000_000);
    const image = decodeImage(body.image);
    const read = await readPaper(image, body.hint, book);
    const aup = await aupCheck(read.items.map((i) => ({ id: i.id, name: `${i.nameEn} (${i.nameOriginal})` })), book);
    return ok({ read, aup, aupChecked: aup !== null }, book.items);
  } catch (err) {
    return fail(err, book.items);
  }
}
