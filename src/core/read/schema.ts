import { z } from "zod";

export const Intent = z.enum(["shop", "invoice", "subscription", "unknown"]);
export type Intent = z.infer<typeof Intent>;

const Box = z.array(z.number().min(0).max(1000)).length(4).describe("[ymin, xmin, ymax, xmax] normalized 0-1000");

export const ReadItem = z.object({
  id: z.string().max(40),
  nameOriginal: z.string().max(200).describe("Exactly as written, any language or script"),
  nameEn: z.string().max(200).describe("English name for international buyers"),
  description: z.string().max(300).optional().describe("Short and honest; no invented claims"),
  unitPrice: z.number().describe("Price per unit in the detected currency, as written"),
  quantity: z.number().optional().describe("Invoices only"),
  unit: z.string().max(40).optional().describe('e.g. "per plate", "per kg"'),
  interval: z.enum(["week", "month", "year"]).optional().describe("Subscriptions only"),
  box: Box,
  confidence: z.number().min(0).max(1),
  retail: z
    .object({
      isBrandedProduct: z.boolean().describe("True only for branded, mass-produced goods; never food, handmade or services"),
      searchQuery: z.string().max(120).optional().describe('Brand + model, e.g. "JBL Go 3"'),
    })
    .optional(),
});
export type ReadItem = z.infer<typeof ReadItem>;

export const Read = z.object({
  intent: Intent,
  intentReason: z.string().max(240),
  business: z.object({ name: z.string().max(120).optional(), kind: z.string().max(80).optional() }),
  sourceLanguage: z.string().max(20).describe("BCP-47, e.g. en, es, fr"),
  currency: z.object({
    detected: z.string().max(3).optional().describe("ISO 4217 code"),
    symbolSeen: z.string().max(8).optional(),
    confidence: z.number().min(0).max(1),
  }),
  items: z.array(ReadItem).max(60),
  customer: z
    .object({
      name: z.string().max(120).optional(),
      email: z.string().max(200).optional(),
      company: z.string().max(120).optional(),
      country: z.string().max(60).optional(),
    })
    .optional(),
  dates: z.object({ issued: z.string().max(40).optional(), due: z.string().max(40).optional() }).optional(),
  writtenTotal: z.number().optional(),
  writtenTotalBox: Box.optional().describe("Where the written total is on the page, if any"),
  taxOrNotes: z.string().max(300).optional(),
  questions: z
    .array(z.object({ id: z.string().max(40), ask: z.string().max(160), options: z.array(z.string().max(40)).max(4).optional() }))
    .max(4),
  warnings: z.array(z.string().max(200)).max(10),
});
export type Read = z.infer<typeof Read>;

/** JSON schema for Gemini's responseJsonSchema. */
export function readJsonSchema() {
  return z.toJSONSchema(Read, { target: "draft-2020-12", unrepresentable: "any" });
}
