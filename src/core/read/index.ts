// Image → Read (intent, items with bounding boxes, customer, warnings).
// Framework-agnostic: no Next.js imports here, so other platforms can reuse it.
// Implemented in Phase 2.

export const READ_INTENTS = ["shop", "invoice", "subscription", "unknown"] as const;
export type ReadIntent = (typeof READ_INTENTS)[number];
