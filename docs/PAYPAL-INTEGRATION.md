# PayPal integration

Every PayPal API and SDK Paperstall uses, where it lives, and what we learned. All calls go to the **sandbox**
(`https://api-m.sandbox.paypal.com`). Request and response shapes were checked against PayPal's published
OpenAPI specs (orders v2, invoicing v2, catalog-products v1, subscriptions v1, payments v2).

| Product | Endpoint / SDK | Purpose | Code |
|---|---|---|---|
| OAuth | `POST /v1/oauth2/token` | App token, cached in memory, refreshed 60 s early; one retry on 401 | `src/server/paypal/client.ts` |
| Orders v2 | `POST /v2/checkout/orders` | Create order: intent CAPTURE, itemised lines (`sku` = stall item id), `amount.breakdown.item_total`, `payee.email_address` = stall payee, `custom_id` = stall id, unique `invoice_id` | `src/server/paypal/ops.ts` → `src/app/api/v1/orders/route.ts` |
| Orders v2 | `POST /v2/checkout/orders/{id}/capture` | Capture after buyer approval; `ORDER_ALREADY_CAPTURED` falls back to GET | `src/app/api/v1/orders/capture/route.ts` |
| Orders v2 | `GET /v2/checkout/orders/{id}` | Verify-to-record: status, capture, payee, amount, currency, stall | `src/app/api/v1/verify/route.ts`, `src/core/verify` |
| Orders v2 | `POST /v2/checkout/orders/{id}/track` | Add shipment tracking (approval-gated) | `src/app/api/v1/orders/[id]/route.ts` |
| Payments v2 | `POST /v2/payments/captures/{id}/refund` | Refunds, capped at the captured amount (approval-gated, owner token, capture must be in the stall's order) | `src/app/api/v1/orders/[id]/route.ts` |
| Invoicing v2 | `POST /v2/invoicing/invoices` | Draft invoice; our total is compared with PayPal's before sending | `src/app/api/v1/invoices/route.ts` |
| Invoicing v2 | `POST …/{id}/send`, `POST …/{id}/generate-qr-code` | Send to customer; QR for the share page | same |
| Invoicing v2 | `GET …/{id}`, `POST …/{id}/remind`, `POST …/{id}/cancel`, `DELETE …/{id}` | Status polling, reminders, cancel, dev health check | `src/app/api/v1/invoices/[id]/route.ts`, `src/app/api/v1/dev/health/route.ts` |
| Catalog Products v1 | `POST /v1/catalogs/products` | Product for a subscription plan | `src/app/api/v1/plans/route.ts` |
| Subscriptions v1 | `POST /v1/billing/plans`, `GET /v1/billing/plans/{id}` | Active plan (optional free trial); public plan page reads price from PayPal | `src/app/api/v1/plans/*` |
| Subscriptions v1 | `POST /v1/billing/subscriptions`, `GET …/{id}` | Create subscription for approval; read status | `src/app/api/v1/subscriptions/route.ts` |
| JS SDK **v6** | `@paypal/paypal-js/sdk-v6` → `createInstance`, `createPayPalOneTimePaymentSession`, `createPayPalSubscriptionPaymentSession`, `<paypal-button>` | Official PayPal buttons for checkout and subscriptions | `src/components/paypal/paypal-button.tsx` |

## Conventions
- Every POST sends a `PayPal-Request-Id` (capture and refund use deterministic ids, so retries are idempotent).
- `Prefer: return=representation` on every call.
- Errors surface PayPal's `debug_id` and first `details[].issue` as `{ code, message, debugId }`.
- Every call is logged as a receipt (method, path, status, debug id, request id, time) and shown in the studio's Receipts drawer.
- Money is integer minor units everywhere; PayPal decimal strings are produced and parsed in `src/core/money.ts`.

## Decisions and findings
- **JS SDK v6 for both rails.** v6 has a `paypal-subscriptions` component, so one-time payments and subscriptions share one loader. The v6 loader injects its script from a nonced script, which `'strict-dynamic'` allows.
- **Invoicer is the API account.** We don't send `invoicer.email_address` (the spec's 422 example shows it must match the account); we only set a business name.
- **QR response media type isn't declared** in the invoicing spec. We extract the base64 PNG whether it comes raw or wrapped in a multipart body (`extractBase64Png`).
- **Payee-email model:** one platform credential creates orders that pay the stall's own PayPal account ([ADR-002](DECISIONS.md)).

## Verified against the live sandbox (2026-11-02)
Through `/dev/health`: OAuth, order create, buyer approval with a sandbox personal account, capture (`COMPLETED`),
and draft invoice create + delete.

Findings:
- **Use US sandbox accounts.** The accounts PayPal auto-creates follow your developer account's country (IN for us).
  Paperstall charges in USD, so we created a US business account (payee, and the app's account) and a US personal
  account (buyer).
- **Enable Invoicing on the app.** Without it, invoice calls fail with `NOT_AUTHORIZED` ("insufficient permissions")
  while orders still work. The token's `scope` must include `https://uri.paypal.com/services/invoicing`.
- **New app features don't reach an existing token.** PayPal keeps returning the same access token (up to ~9 h) for
  `client_credentials`, so a feature enabled after that token was issued doesn't apply. End it with
  `POST /v1/oauth2/token/terminate`, then restart the server so our in-memory token cache is dropped too.

Through the app's own API routes (same day): a signed USD stall → `POST /orders` with server-side pricing
(`CREATED`, payee and `custom_id` correct on `GET /orders/{id}`); `POST /invoices` (draft → send → QR, PayPal total
matched ours); `POST /plans` (catalog product + `ACTIVE` plan); `POST /subscriptions` (`APPROVAL_PENDING`);
`POST /verify` on an unpaid order (rejected as `not_paid`); and a partial refund through `POST /orders/{id}`
(`COMPLETED`). Channel3 returned a match for "AirPods Max 2".

In the browser (same day): a published stall → sandbox buyer approves on the storefront button → capture → receipt QR
→ `/verify` records the paid order in the ledger (US$11.75, three items).

Tax: a stall carries the paper's tax as a basis-point rate. Orders send it as `breakdown.tax_total`, so PayPal shows it
as tax and `amount.value = item_total + tax_total`; `verifyOrder` recomputes the same total. Verified live: a $21.21
receipt with $1.49 tax created a $22.70 order. Invoices carry the paper's tax amount as its own line, so PayPal's total
matches the paper exactly.

Not yet run live: buyer approval of a subscription.
