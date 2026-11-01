import type { NextRequest } from "next/server";
import { z } from "zod";
import { signStall, MAX_SIGNED_LENGTH } from "@/core/signing";
import { StallPayload, STALL_VERSION } from "@/core/stall";
import { assertSameOrigin, fail, HttpError, ok, parseJson, rateLimit } from "@/server/http";
import { signingSecret } from "@/server/stall";

// Links last a year; sellers republish to change prices anyway.
const TTL_SECONDS = 365 * 24 * 60 * 60;

const Body = z.object({ payload: StallPayload.omit({ v: true, x: true }) });

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    rateLimit(req, "stall-sign", 30);
    const { payload } = await parseJson(req, Body);
    const signed = signStall({ ...payload, v: STALL_VERSION, x: Math.floor(Date.now() / 1000) + TTL_SECONDS }, signingSecret());
    if (signed.length > MAX_SIGNED_LENGTH) throw new HttpError(413, "STALL_TOO_LARGE", "This stall has too much text for a link. Shorten some names or remove descriptions.");
    return ok({ signed });
  } catch (err) {
    return fail(err);
  }
}
