# Integrating Paperstall

How a platform (PayPal, a POS, a marketplace) could adopt Paperstall.

## What's already reusable
- **Core in `src/core`:** no Next.js imports. It holds the Read schema and checks, money math, stall signing, `verifyOrder`, market matching, Penny's tools and approval gate, and the OpenAPI generator. Any Node or edge runtime can use it.
- **Versioned HTTP API** under `/api/v1`, documented at `/docs/api`. The OpenAPI 3.1 spec at `/api/v1/openapi.json` is generated from the same zod schemas, and `pnpm postman` turns it into a Postman collection.
- **Rails** sit behind a `Rail` interface (`src/core/rails`); Payouts or Donations would be one more adapter.
- **Receipts:** every response lists the PayPal, Gemini and Channel3 calls it made, with PayPal debug IDs, so an integrator can audit everything.

## Real-world path (honest effort estimates)
| Step | What changes | Effort |
|---|---|---|
| Seller onboarding | PayPal partner / multiparty onboarding instead of a typed payee email; store the merchant id | 1–2 weeks |
| Cross-device ledger | Verified PayPal webhooks (`CHECKOUT.ORDER.COMPLETED`, `INVOICING.INVOICE.PAID`) + a small store keyed by seller | 1 week |
| Embeddable widget | `<script>`/iframe "Snap to sell" that posts the image to `/api/v1/ai/read` and returns a signed stall link | 3–5 days |
| Sharing | WhatsApp / Instagram share sheets with the stall QR | 1–2 days |
| Offline | Queue captures and verifications while offline; replay on reconnect | 1 week |
| Languages | Translate UI copy; the Read already handles any script and returns English names | ongoing |
| Sandbox → live | Live credentials, live webhook ids, a real FX source, production review of the acceptable-use check | 1 week |

## Why PayPal benefits
Paper-based sellers get onto PayPal in under a minute with no forms; the AI picks the right PayPal product; every sale
is verified against PayPal before it's recorded, which defeats fake payment screenshots; and stalls are machine-readable,
ready for agentic commerce.
