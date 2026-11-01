import type { NextRequest } from "next/server";
import { z } from "zod";
import { verifyStall } from "@/core/signing";
import { fail, ok, parseJson, rateLimit } from "@/server/http";
import { signingSecret } from "@/server/stall";

const Body = z.object({ signed: z.string().max(8000) });

/** Lets the storefront warn buyers before checkout if a link was edited or expired. */
export async function POST(req: NextRequest) {
  try {
    rateLimit(req, "stall-check", 60);
    const { signed } = await parseJson(req, Body);
    const v = verifyStall(signed, signingSecret());
    return ok(v.ok ? { ok: true } : { ok: false, reason: v.reason });
  } catch (err) {
    return fail(err);
  }
}
