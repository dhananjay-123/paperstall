# Security

Paperstall handles payments, so it is built like a payments product. This file describes what exists today; the
"Planned" section lists what is not built yet.

## In place
- **Secrets**: `GEMINI_API_KEY`, `PAYPAL_CLIENT_SECRET`, `PAYLOAD_SIGNING_SECRET` and `CHANNEL3_API_KEY` are read only in `src/lib/env.ts`, which imports `server-only` (a build error if a client component imports it) and validates with zod. `.env*` is git-ignored except `.env.example`, which has keys and no values. `MOCK_AI=1` is refused in production.
- **Secret scanning**: gitleaks runs in CI on every push (`.github/workflows/ci.yml`).
- **HTTP headers** (`src/proxy.ts`, values in `src/lib/csp.ts`, unit-tested):
  - Content-Security-Policy: scripts only from our origin with a per-request nonce (`'strict-dynamic'`), plus PayPal SDK hosts; frames only PayPal/Venmo checkout; `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` in production. `'unsafe-eval'` only in development.
  - `style-src` allows `'unsafe-inline'`: server-rendered `style` attributes can't carry a nonce. Script execution stays nonce-only.
  - `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera on self only; no microphone or geolocation), HSTS in production.
- **No trackers**: no analytics scripts.

## Planned (not yet built)
Signed payloads (HMAC-SHA256, constant-time compare, version + expiry), server-side amount recomputation in integer
minor units, `PayPal-Request-Id` idempotency, verify checks, per-IP rate limits, same-origin checks, input limits,
approval-gated agent tools, `/privacy` page.

## Reporting
Please open a GitHub issue without sensitive details and ask for a private contact.
