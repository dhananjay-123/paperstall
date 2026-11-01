# Security

Paperstall handles payments, so it is built like a payments product. This file describes what exists today.

## Secrets
- `GEMINI_API_KEY`, `PAYPAL_CLIENT_SECRET`, `PAYLOAD_SIGNING_SECRET` and `CHANNEL3_API_KEY` are read only by server modules (`import "server-only"`), validated with zod in `src/lib/env.ts`.
- `.env*` is git-ignored except `.env.example` (keys, no values). `MOCK_AI=1` is refused in production.
- Client bundle check after `pnpm build`: no `AIza` keys, no secret variable names, and not the signing secret's value appear in `.next/static`.
- gitleaks runs in CI on every push.

## Money integrity
- Integer minor units only (`src/core/money.ts`, unit-tested).
- Stall links are HMAC-SHA256 signed (128-bit truncated, constant-time compare) with a version and a one-year expiry. Every money route re-verifies the signature and recomputes prices from the signed stall; client totals are never used. Editing a price in the URL gives `STALL_TAMPERED`.
- `PayPal-Request-Id` on every POST; deterministic ids for capture and refund.
- **Verify-to-record:** a sale enters the ledger only after `GET /v2/checkout/orders/{id}` passes `verifyOrder`: completed order and capture, payee = stall payee, every line priced as on the stall, totals equal, currency equal, right stall, not already recorded (order id or capture id). Receipt QRs are HMAC-signed; forged or other-stall receipts are rejected. Every fail reason is unit-tested.
- Refunds are capped at the captured amount on the server. Invoices are only sent if PayPal's computed total equals ours.

## AI safety
- Images and buyer/seller text are treated as data; every prompt says so.
- Penny's tools are allow-listed and zod-validated; mutating tools never execute inside the agent: they become Approval Cards and run through the same routes as the UI, only after the seller approves (unit-tested). Max 5 tool steps per turn.
- The concierge can only return items from the signed stall; the server drops anything else.

## Input limits
Image type sniffed by magic bytes (JPEG/PNG/WebP), ≤4 MB after client downscaling to ≤1600 px; request size caps on every route; text length caps in every schema; signed stall length cap.

## HTTP hardening (`src/proxy.ts`, `src/lib/csp.ts`, unit-tested)
- CSP: scripts only from our origin with a per-request nonce plus `'strict-dynamic'` and PayPal hosts; frames only PayPal/Venmo; `object-src 'none'`; `base-uri 'self'`; `form-action` self + PayPal; `frame-ancestors 'none'`; `upgrade-insecure-requests` in production; `'unsafe-eval'` only in development.
- `style-src` allows `'unsafe-inline'` (server-rendered `style` attributes can't carry a nonce). `img-src` allows `https:` for market-check product photos; images can't run script.
- `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera on self only), HSTS in production.

## Abuse
Per-IP token-bucket rate limits on AI, PayPal and stall routes (best-effort on serverless: each instance has its own buckets). Same-origin check on mutating routes. CORS is closed except the read-only OpenAPI spec.

## Privacy
No analytics or trackers; no PII in server logs (errors log only an error name). `/privacy` explains what stays on the device and what goes to PayPal, Gemini and Channel3.

## Not yet done
`pnpm audit` review, an external header scan on the deployed URL, and webhook signature verification (no webhooks are used).

## Reporting
Please open a GitHub issue without sensitive details and ask for a private contact.
