# Decisions

Short ADRs: context → decision → consequences.

## ADR-001 — No database
**Context:** Solo hackathon build; judges must be able to use it without sign-up.
**Decision:** Seller state in `localStorage` (zustand `persist`, key `paperstall:v1`); storefronts in signed URL payloads; server routes are stateless.
**Consequences:** No cross-device sync. Sales reach the seller through verify (ADR-003). A production version adds webhooks + a small store (see INTEGRATE.md).

## ADR-002 — Payee-email model
**Context:** Many sellers, no partner onboarding in a hackathon.
**Decision:** One platform REST credential creates orders with `purchase_units[].payee.email_address` set to the stall's payee.
**Consequences:** Real multi-seller payouts in sandbox. Production would use PayPal multiparty onboarding.

## ADR-003 — Verify-to-record
**Context:** Fake "payment done" screenshots are a real scam; there is no shared database.
**Decision:** A sale enters the seller's ledger only after the server confirms the order with PayPal through Scan to confirm (status, capture status, payee, amount, currency, replay). Part of Phase 3, not a later add-on.
**Consequences:** The seller scans the buyer's receipt QR (or types an order ID). Checkouts in the seller's own browser write directly after capture.

## ADR-005 — Nonce CSP in `src/proxy.ts`, every page dynamic
**Context:** A strict script CSP needs a per-request nonce. Next.js 16 renamed middleware to `proxy`; its docs state nonces need dynamic rendering and are incompatible with partial prerendering.
**Decision:** Generate the nonce and set all security headers in `src/proxy.ts`; turn off `cacheComponents`; the root layout reads `headers()` (making pages dynamic) and nonces the theme script. `style-src` allows `'unsafe-inline'` because server-rendered `style` attributes can't carry a nonce.
**Consequences:** No static/CDN caching of pages. Scripts stay nonce-only.

## ADR-006 — Channel3 for the market check
**Context:** Small sellers often misprice branded goods.
**Decision:** Use Channel3 product search for branded items the Read flags; show a price range, suggested price, typo-style price guard and optional product photo. Key is server-only; the feature hides itself when the key is missing or a call fails.
**Consequences:** Pricing help with real data and no blocking dependency. Matches below a confidence threshold are never shown.

## ADR-007 — Ledger is a shadcn data table, not AG Grid
**Context:** The AG Grid sponsor track needs AG Studio, its agent framework and a trial licence that expires around judging.
**Decision:** Build the ledger with shadcn's data table (TanStack Table).
**Consequences:** One fewer dependency and licence; the ledger matches the rest of the design system.

## ADR-009 — PayPal JS SDK v6 for checkout and subscriptions
**Context:** The plan asked for v6 where it supports subscriptions.
**Decision:** v6 ships a `paypal-subscriptions` component, so both rails use `@paypal/paypal-js/sdk-v6` and the official `<paypal-button>`.
**Consequences:** One loader and one button component; CSP keeps `'strict-dynamic'` so the nonced loader can inject PayPal's script.

## ADR-010 — Own typed PayPal tool layer instead of the Agent Toolkit
**Context:** Penny runs on Gemini function calling with a strict approval gate.
**Decision:** A small typed tool layer in `src/core/agent` mirrors the toolkit's operations. Mutating tools only return proposals and execute through our own approval-gated routes.
**Consequences:** No framework coupling, and the gate is enforced by construction and unit-tested.

## ADR-011 — TanStack Table v8 for the ledger
**Context:** `@tanstack/react-table` v9 changed its API (`useTable`, feature registration); shadcn's data-table pattern is built on v8.
**Decision:** Pin v8.
**Consequences:** Stable, documented API; revisit when shadcn moves to v9.

## ADR-008 — Global audience
**Context:** Paper-based small sellers exist everywhere; judges and sandbox accounts are US-based.
**Decision:** No country-specific framing. Samples: coffee cart, a freelancer's bill, a piano-lessons notice, a phone-accessories stall and an optional Spanish menu. USD sandbox accounts; other currencies supported where PayPal supports them.
**Consequences:** Copy and samples work for any judge; translation is shown through the Spanish sample.

## ADR-012 — Live counter over an ntfy.sh "doorbell"
**Context:** Sellers at a laptop or tablet can't easily scan a buyer's phone, and self-serve buyers pay without the seller seeing it. There is no database to fan out "new order" events, and PayPal can't list a merchant's recent orders.
**Decision:** After a verified capture the server posts only the order ID to a per-stall ntfy.sh topic. The topic is random, returned to the seller once at publish, and carried in the link sealed with AES-256-GCM. The seller's studio subscribes over SSE, re-checks every order with PayPal, and shows it with an HMAC pickup code. A Web Lock keeps recording to one tab per stall; devices post "counted" messages to the same topic for cross-device replay protection.
**Consequences:** Free, no signup, no new server state. The message is untrusted by design, so a forged or replayed doorbell can't create a sale. The cost is a dependency on ntfy.sh's public tier (250 messages a day per sender, about 12 hours of history): receipt scanning stays as the fallback, and ntfy can be self-hosted.
