import { z } from "zod";
import { Read } from "./read/schema";
import { Cart, StallPayload } from "./stall";

// OpenAPI 3.1 for Paperstall's HTTP API, generated from the same zod schemas the routes use.

const json = (s: z.ZodType) => z.toJSONSchema(s, { target: "draft-2020-12", unrepresentable: "any" });

const ApiError = z.object({ code: z.string(), message: z.string(), debugId: z.string().optional(), retryAfter: z.number().optional() });
const Receipt = z.object({
  id: z.string(),
  at: z.string(),
  service: z.enum(["paypal", "gemini", "channel3"]),
  method: z.string(),
  path: z.string(),
  status: z.number(),
  ok: z.boolean(),
  debugId: z.string().optional(),
  requestId: z.string().optional(),
  ms: z.number(),
});
const Verdict = z.union([
  z.object({ ok: z.literal(true), orderId: z.string(), captureId: z.string(), currency: z.string(), totalMinor: z.number().int(), items: z.array(z.object({ id: z.string(), name: z.string(), quantity: z.number().int() })), paidAt: z.string().optional() }),
  z.object({ ok: z.literal(false), reason: z.enum(["not_paid", "wrong_payee", "amount_mismatch", "currency_mismatch", "wrong_stall", "already_recorded"]), message: z.string(), recordedAt: z.string().optional() }),
]);
const Signed = z.string().describe("Signed stall link payload: `<lz-string>.<HMAC>` (the part after `/s#`)");

type Op = { summary: string; description?: string; tag: string; body?: z.ZodType; response: z.ZodType; method?: "post" | "get"; params?: string[] };

const OPS: Record<string, Op> = {
  "/api/v1/ai/read": {
    tag: "AI",
    summary: "Read a photo of paper",
    description: "Image → structured Read (intent, items with 0–1000 boxes, currency, questions, warnings) plus an acceptable-use check. Rate-limited per IP.",
    body: z.object({ image: z.string().describe("Base64 JPEG/PNG/WebP, ≤4 MB"), hint: z.string().max(200).optional() }),
    response: z.object({ read: Read, aup: z.array(z.object({ id: z.string(), reason: z.string() })).nullable(), aupChecked: z.boolean() }),
  },
  "/api/v1/market": {
    tag: "AI",
    summary: "Market check for branded items (Channel3)",
    body: z.object({ currency: z.string().length(3), items: z.array(z.object({ id: z.string(), query: z.string() })).max(10) }),
    response: z.object({ enabled: z.boolean(), matches: z.record(z.string(), z.unknown()) }),
  },
  "/api/v1/stalls/sign": {
    tag: "Stalls",
    summary: "Sign a stall so it can take payments",
    body: z.object({ payload: StallPayload.omit({ v: true, x: true }) }),
    response: z.object({ signed: Signed }),
  },
  "/api/v1/stalls/check": { tag: "Stalls", summary: "Check a stall link's signature and expiry", body: z.object({ signed: Signed }), response: z.object({ ok: z.boolean(), reason: z.string().optional() }) },
  "/api/v1/orders": {
    tag: "Checkout",
    summary: "Create a PayPal order from a signed stall and a cart",
    description: "Prices are recomputed on the server from the signed stall; client totals are ignored. The stall's payee receives the money.",
    body: z.object({ signed: Signed, cart: Cart, notes: z.record(z.string(), z.string().max(100)).optional() }),
    response: z.object({ orderId: z.string() }),
  },
  "/api/v1/orders/capture": {
    tag: "Checkout",
    summary: "Capture an approved order and get the signed receipt code",
    body: z.object({ signed: Signed, orderId: z.string() }),
    response: z.object({ orderId: z.string(), captureId: z.string(), totalMinor: z.number().int(), currency: z.string(), receiptCode: z.string() }),
  },
  "/api/v1/verify": {
    tag: "Verify",
    summary: "Verify a payment with PayPal before recording it",
    description: "Checks order + capture status, payee, amount, currency, stall and replay. Send a scanned receipt `code` or a typed `orderId`.",
    body: z.object({ code: z.string().optional(), orderId: z.string().optional(), signed: Signed, recorded: z.object({ orderIds: z.array(z.string()), captureIds: z.array(z.string()) }) }),
    response: z.object({ verdict: Verdict }),
  },
  "/api/v1/invoices": {
    tag: "Invoicing",
    summary: "Create, send and QR a PayPal invoice",
    body: z.object({
      currency: z.string().length(3),
      businessName: z.string().optional(),
      recipient: z.object({ email: z.email(), givenName: z.string().optional(), surname: z.string().optional(), businessName: z.string().optional() }),
      items: z.array(z.object({ name: z.string(), quantity: z.number().int(), unitMinor: z.number().int() })),
      dueDate: z.string().optional(),
      memo: z.string().optional(),
      note: z.string().optional(),
    }),
    response: z.object({ id: z.string(), number: z.string().optional(), status: z.string(), totalMinor: z.number().int(), payerUrl: z.string().optional(), qrPng: z.string().optional() }),
  },
  "/api/v1/plans": {
    tag: "Subscriptions",
    summary: "Create a Catalog Product + active Billing Plan",
    body: z.object({ name: z.string(), description: z.string().optional(), currency: z.string().length(3), priceMinor: z.number().int(), interval: z.enum(["week", "month", "year"]), trialCycles: z.number().int().optional() }),
    response: z.object({ productId: z.string(), planId: z.string(), status: z.string() }),
  },
  "/api/v1/subscriptions": {
    tag: "Subscriptions",
    summary: "Create a subscription for approval, or read its status",
    body: z.union([z.object({ planId: z.string() }), z.object({ subscriptionId: z.string() })]),
    response: z.object({ subscriptionId: z.string(), status: z.string() }),
  },
  "/api/v1/ai/concierge": {
    tag: "AI",
    summary: "Buyer concierge: request → cart proposal from this stall's items only",
    body: z.object({ signed: Signed, ask: z.string().max(300) }),
    response: z.object({ lines: z.array(z.object({ id: z.string(), qty: z.number().int(), note: z.string().optional() })), explanation: z.string() }),
  },
  "/api/v1/ai/penny": {
    tag: "AI",
    summary: "Penny, the seller's clerk",
    description: "Gemini function calling over PayPal tools. Mutating tools return proposals only; they execute through the routes above after the seller approves.",
    body: z.object({ messages: z.array(z.object({ role: z.enum(["user", "model"]), text: z.string() })), context: z.record(z.string(), z.unknown()) }),
    response: z.object({ reply: z.string(), proposals: z.array(z.object({ id: z.string(), tool: z.string(), args: z.record(z.string(), z.unknown()) })) }),
  },
};

export function openApiSpec(serverUrl: string) {
  const paths: Record<string, unknown> = {};
  for (const [path, op] of Object.entries(OPS)) {
    paths[path] = {
      [op.method ?? "post"]: {
        tags: [op.tag],
        summary: op.summary,
        ...(op.description ? { description: op.description } : {}),
        ...(op.body ? { requestBody: { required: true, content: { "application/json": { schema: json(op.body) } } } } : {}),
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: json(op.response), receipts: { type: "array", items: json(Receipt) } } } } } },
          default: { description: "Error", content: { "application/json": { schema: { type: "object", properties: { error: json(ApiError), receipts: { type: "array", items: json(Receipt) } } } } } },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Paperstall API",
      version: "1.0.0",
      description: "Paper → intent → PayPal rail. Sandbox only. Every response carries `receipts`: the outbound PayPal/Gemini/Channel3 calls it made, with PayPal debug IDs.",
      license: { name: "MIT", identifier: "MIT" },
    },
    servers: [{ url: serverUrl }],
    paths,
  };
}

export const API_OPERATIONS = Object.entries(OPS).map(([path, op]) => ({ path, method: (op.method ?? "post").toUpperCase(), tag: op.tag, summary: op.summary, description: op.description }));
