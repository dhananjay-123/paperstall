import type { NextRequest } from "next/server";
import { z } from "zod";
import { ownerToken, signStall, MAX_SIGNED_LENGTH } from "@/core/signing";
import { StallPayload, STALL_VERSION } from "@/core/stall";
import { assertSameOrigin, fail, HttpError, ok, parseJson, rateLimit } from "@/server/http";
import { newTopic, sealTopic } from "@/server/doorbell";
import { signingSecret } from "@/server/stall";

// Links last a year; sellers republish to change prices anyway.
const TTL_SECONDS = 365 * 24 * 60 * 60;

// The server picks the stall ID, so nobody can sign a stall under someone else's ID and use it
// to act on their orders. Any client-sent id is dropped.
const Body = z.object({ payload: StallPayload.omit({ v: true, x: true, nt: true, id: true }) });

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    rateLimit(req, "stall-sign", 30);
    const { payload } = await parseJson(req, Body);
    // Every publish gets a fresh doorbell topic; it goes back to the seller once, in clear.
    const doorbell = newTopic();
    const nt = sealTopic(doorbell, signingSecret());
    const id = crypto.randomUUID();
    const signed = signStall({ ...payload, id, nt, v: STALL_VERSION, x: Math.floor(Date.now() / 1000) + TTL_SECONDS }, signingSecret());
    if (signed.length > MAX_SIGNED_LENGTH) throw new HttpError(413, "STALL_TOO_LARGE", "This stall has too much text for a link. Shorten some names or remove descriptions.");
    // The owner token goes back to the seller once; refunds and shipping need it.
    return ok({ signed, doorbell, id, owner: ownerToken("stall", id, signingSecret()) });
  } catch (err) {
    return fail(err);
  }
}
