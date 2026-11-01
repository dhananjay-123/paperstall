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

## ADR-004 — Repo root is `paperstall/`
**Context:** The hackathon prompt pack sits next to the code.
**Decision:** The git repo is the `paperstall/` folder; prompt files stay outside it.
**Consequences:** The public repo contains only the product.

## ADR-005 — Nonce CSP in `src/proxy.ts`, every page dynamic
**Context:** A strict script CSP needs a per-request nonce. Next.js 16 renamed middleware to `proxy`; its docs state nonces need dynamic rendering and are incompatible with partial prerendering.
**Decision:** Generate the nonce and set all security headers in `src/proxy.ts`; turn off `cacheComponents`; the root layout reads `headers()` (making pages dynamic) and nonces the theme script. `style-src` allows `'unsafe-inline'` because server-rendered `style` attributes can't carry a nonce.
**Consequences:** No static/CDN caching of pages. Scripts stay nonce-only.

## ADR-006 — Channel3 for the market check (the one sponsor prize)
**Context:** Small sellers often misprice branded goods, and a project can win only one sponsor prize.
**Decision:** Use Channel3 product search for branded items the Read flags; show a price range, suggested price, typo-style price guard and optional product photo. Key is server-only; the feature hides itself when the key is missing or a call fails.
**Consequences:** Pricing help with real data and no blocking dependency. Matches below a confidence threshold are never shown.

## ADR-007 — Ledger is a shadcn data table, not AG Grid
**Context:** The AG Grid sponsor track needs AG Studio, its agent framework and a trial licence that expires around judging.
**Decision:** Build the ledger with shadcn's data table (TanStack Table).
**Consequences:** One fewer dependency and licence; the ledger matches the rest of the design system.

## ADR-008 — Global audience
**Context:** Paper-based small sellers exist everywhere; judges and sandbox accounts are US-based.
**Decision:** No country-specific framing. Samples: coffee cart, a freelancer's bill, a piano-lessons notice, a phone-accessories stall and an optional Spanish menu. USD sandbox accounts; other currencies supported where PayPal supports them.
**Consequences:** Copy and samples work for any judge; translation is shown through the Spanish sample.
