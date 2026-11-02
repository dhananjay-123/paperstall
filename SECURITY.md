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
- **Live counter:** a doorbell message is only a nudge. Each order is re-checked with PayPal by the seller's device before it shows or counts, so forged messages create nothing. The topic is a random secret, sealed (AES-256-GCM, key derived from the signing secret) inside the signed link, and never accepted from the client at signing. A 4-character HMAC pickup code on the receipt and the counter card stops someone claiming another buyer's order. One tab per stall records (Web Locks), and devices share counted order IDs on the topic.
- **Owner tokens:** the server assigns every stall ID at publish and returns an owner token (HMAC of the ID) once, to the publishing device only; invoices get one when they're sent. Refund and ship need the stall's token, and the order must carry that stall ID with the capture inside that order. Remind and cancel need the invoice's token. Order, invoice and stall IDs are public (receipts, share pages, links), so knowing an ID is never enough to act on it (ADR-013, unit-tested).
- Refunds are capped at the captured amount on the server. Invoices are only sent if PayPal's computed total equals ours.

## AI safety
- Images and buyer/seller text are treated as data; every prompt says so.
- Penny's tools are allow-listed and zod-validated; mutating tools never execute inside the agent: they become Approval Cards and run through the same routes as the UI, only after the seller approves (unit-tested). Max 5 tool steps per turn.
- The concierge can only return items from the signed stall; the server drops anything else.

## Input limits
Third-party URLs (Channel3 offers and photos, item photos in signed stalls) must be `https:`; anything else is dropped or refused before it reaches an `href` or `src`. Image type sniffed by magic bytes (JPEG/PNG/WebP), ≤4 MB after client downscaling to ≤1600 px; request size caps on every route; text length caps in every schema; signed stall length cap.

## HTTP hardening (`src/proxy.ts`, `src/lib/csp.ts`, unit-tested)
- CSP: scripts only from our origin with a per-request nonce plus `'strict-dynamic'` and PayPal hosts; `connect-src` adds only `https://ntfy.sh` for the live counter; frames only PayPal/Venmo; `object-src 'none'`; `base-uri 'self'`; `form-action` self + PayPal; `frame-ancestors 'none'`; `upgrade-insecure-requests` in production; `'unsafe-eval'` only in development.
- `style-src` allows `'unsafe-inline'` (server-rendered `style` attributes can't carry a nonce). `img-src` allows `https:` for market-check product photos; images can't run script.
- `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera on self only), HSTS in production.

## Abuse
Per-IP token-bucket rate limits on AI, PayPal and stall routes (best-effort on serverless: each instance has its own buckets). Same-origin check on mutating routes. CORS is closed except the read-only OpenAPI spec.

## Privacy
No analytics or trackers; no PII in server logs (errors log only an error name). `/privacy` explains what stays on the device and what goes to PayPal, Gemini, Channel3 and ntfy.sh (order IDs only).

## Audit (2026-11-02)
A review of every API route, the signing and doorbell code, the CSP and the client bundle before the first deploy.

| Severity | Finding | Status |
| --- | --- | --- |
| High | Anyone who knew an order ID (every buyer knows their own) could refund it or add tracking through `POST /api/v1/orders/{id}`. The same-origin check doesn't apply to non-browser clients, and the route didn't check who was asking. A buyer could pay, collect, then refund themselves. | Fixed: stall owner token, order ↔ stall and capture ↔ order checks |
| Medium | Anyone with an invoice share link could cancel the invoice or send reminder emails via `POST /api/v1/invoices/{id}`. | Fixed: invoice owner token |
| Medium | Stall IDs were chosen by the client, so a second stall could be signed under an existing stall's ID. | Fixed: the server assigns IDs |
| Low | Channel3 offer links were rendered as `href` without a scheme check, and item photo URLs accepted any scheme. | Fixed: `https:` only |
| Low | `pnpm audit`: one moderate (minimatch) and one low (deepmerge) advisory, both under the `shadcn` CLI and never loaded at runtime. | Accepted |
| Info | Checked and fine: no secret values or names in `.next/static`, `.env*` untracked, `/dev/health` 404s in production, `MOCK_AI` refused in production, prices always recomputed from the signed stall, receipt QRs and stall links HMAC-verified, CSP nonce-only scripts. | — |

Verified locally and again on the deployed site (paperstall.vercel.app) against the PayPal sandbox: no token, a forged token, another stall's token, another stall's order and a capture from another order are all refused. Stalls and invoices made before this change have no token, so publish or send them again to refund or cancel from the app.

## Known limits
- **No seller accounts.** Creating an invoice or plan, signing a stall, and the AI routes are open to anyone, limited only by per-IP rate limits that are best-effort on serverless. That's acceptable on the sandbox. A production launch needs seller sign-in (for example Log in with PayPal) and a shared rate-limit store.
- The owner token lives in the seller's browser storage. Anyone with access to that device, or an export file, can act as the seller.
- The sandbox buyer login on the landing page is a public test account by design (`NEXT_PUBLIC_*`, sandbox only).

Deployed headers checked on paperstall.vercel.app: nonce CSP, HSTS with preload, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy` all present, no `X-Powered-By`, and `/dev/health` returns 404. Production uses its own signing secret, separate from development.

## Not yet done
A third-party header scan (for example securityheaders.com), and webhook signature verification (no webhooks are used).

## Reporting
Please open a GitHub issue without sensitive details and ask for a private contact.
