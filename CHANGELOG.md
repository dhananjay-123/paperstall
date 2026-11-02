# Changelog

## Security audit (2026-11-02)
- Fixed (high): refunds and tracking needed only an order ID. They now need the stall's owner token, and the server checks with PayPal that the order belongs to that stall and the capture to that order.
- Fixed: invoice remind and cancel need the invoice's owner token, so a share link can't cancel an invoice.
- Fixed: the server assigns stall IDs, so a stall can't be signed under another stall's ID.
- Fixed: only `https:` URLs from the market check and in item photos.
- Audit table, accepted risks and known limits in [SECURITY.md](SECURITY.md); design in ADR-013.

## Live counter and design overhaul (2026-11-02)
- Live counter: paid orders appear in the studio by themselves via an ntfy.sh doorbell, each re-checked with PayPal; pickup codes on receipts and cards; one recording tab per stall; cross-device "already counted".
- Studio redesigned as a dashboard: live orders with stats, sales ledger, My stall (paper → QR poster) and Penny side by side; bottom tab bar on phones.
- New logo (awning over a circled price list) as an SVG that follows the theme, plus a new app icon.
- Landing page: an interactive paper-to-paid walkthrough on the taco sample, a "screenshot is not a payment" check, a sample switcher on cached Reads, and the verification trail.
- Type moved to Schibsted Grotesk with Caveat notes; cooler paper; chalk yellow for primary actions in dark mode.
- Storefront reads like a menu; the Read page scans and uses chalk-coloured circles on chalkboards; verify works from a desk (mirrored webcam, grouped order ID, USB QR scanners).

## Live sandbox run, tax and samples (2026-11-02)
- Full sandbox flow verified: stall checkout with the buyer account → receipt → Scan to confirm → ledger; invoice send + QR; plan + subscription create; partial refund.
- Tax: the Read picks up tax amounts and stated rates; stalls charge tax as a rate (PayPal `tax_total`), verify includes it, invoices add it as a line. Menus show a sales-tax rate instead of a meaningless "total".
- Five built-in samples (coffee cart, freelancer bill, piano lessons, phone accessories, Spanish taco stand) with cached Reads.
- Undo for a removed item; lighter ink circles; the verify page says what happens next.
- Fixed: the receipt page looped after a reload.

## Sandbox verification + market check fix (2026-11-02)
- PayPal sandbox verified live via `/dev/health`: OAuth, order create, buyer approval, capture, draft invoice create + delete. Findings in `docs/PAYPAL-INTEGRATION.md`.
- Channel3 verified live. The market check now pools single-store listings of the same product, so price chips show for most branded items (7 of 8 test products, up from 1); near-miss models stay out.

## Phase 6 (part) — Studio and finish (2026-11-02)
- Landing page with the judge quick path (sandbox buyer from env), navigation, PWA manifest and icon.
- Studio: overview (today's takings, pending invoices, photo→published metric), share card + printable A5 poster, ledger (TanStack Table v8: search, status filter, CSV, sticky header, mobile cards, approval-gated refund/track/remind), settings (payee, display currency + seller-set rate, sound, export/import/reset).
- OpenAPI 3.1 at `/api/v1/openapi.json`, `/docs/api`, and a Postman collection generator.

## Phase 5 — Agents (2026-11-02)
- Penny: Gemini function calling over typed PayPal tools; mutating tools only return proposals (tested); Approval Cards execute through the UI routes.
- Buyer concierge on the storefront, constrained to the stall's items.

## Phase 4 — Invoice + Subscription (2026-11-02)
- Invoice side-by-side (paper ↔ PayPal preview, hover-linked lines), send + QR, `/i/[id]` live status with backoff; paid invoices reach the ledger only when PayPal says so.
- Catalog Product + Billing Plan (optional trial) and `/sub/[planId]` with the v6 subscribe button.

## Phase 3 — Shop rail + Verify (2026-11-02)
- Signed stall links, storefront with cart and PayPal JS SDK v6 button, server-priced orders paying the stall's payee, capture, buyer receipt with a signed QR.
- `/verify`: camera scanner (BarcodeDetector or jsQR), counter mode, manual order id, `verifyOrder` with every fail reason, ledger write, Paid moment with a Web Audio "ka-ching".

## Phase 2 — Capture + Read + Market check (2026-11-02)
- `/new` (camera, upload, draw pad, samples), `/api/v1/ai/read`, `/new/read` with ink circles, stamp, editable items, questions, math/sanity/AUP checks, crops; Channel3 market check with price guard.
- Gemini schema sanitiser (Gemini rejects `minItems`/`maxItems`); models chosen by `pnpm probe:gemini`.

## Phase 1 — Plumbing (2026-11-02)
- Typed PayPal REST client (token cache, idempotency, debug ids), receipts, Gemini client with backoff and repair, `scripts/probe-gemini.ts`, `/dev/health`.

## Phase 0 — Scaffold (2026-11-01)
- Next.js 16, pnpm, Tailwind v4, shadcn/ui; Ink & Ledger tokens, fonts, paper + blueprint themes; nonce CSP in `src/proxy.ts`; `/design`; vitest; CI; docs; MIT.
