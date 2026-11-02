import "server-only";
import { verifyOwner, verifyStall, type OwnedKind } from "@/core/signing";
import type { StallPayload } from "@/core/stall";
import { requireEnv } from "@/lib/env";
import { HttpError } from "@/server/http";

export const signingSecret = () => requireEnv("PAYLOAD_SIGNING_SECRET");

const REASONS = {
  malformed: "This stall link is incomplete. Ask the seller for a fresh link.",
  tampered: "This stall link was changed after the seller published it, so it can't take payments.",
  expired: "This stall link has expired. Ask the seller for a fresh link.",
  invalid: "This stall link isn't valid.",
} as const;

/** Every money route starts here: prices come only from a stall the server signed. */
export function trustedStall(signed: string): StallPayload {
  const v = verifyStall(signed, signingSecret());
  if (!v.ok) throw new HttpError(400, `STALL_${v.reason.toUpperCase()}`, REASONS[v.reason]);
  return v.payload;
}

/** Refunds, shipping and invoice actions need the owner token the creator got back. */
export function assertOwner(kind: OwnedKind, id: string, token: unknown) {
  if (!verifyOwner(kind, id, token, signingSecret())) {
    throw new HttpError(403, "NOT_OWNER", kind === "stall" ? "Only the device that published this stall can do that. Publish it again on this device." : "Only the device that sent this invoice can do that.");
  }
}
