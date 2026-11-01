# Tasks
_Last updated: 2026-11-01 · Current phase: 0 (awaiting "Phase 0 verified") · Days to deadline: 11_

## Now (this phase)
- [ ] Human check of Phase 0: open `/` and `/design`, cycle the theme (system → paper → blueprint), press "Replay the Read"
- [ ] Create the public GitHub repo `paperstall` and push (commands in the Phase 0 report; done by the human)
- [ ] Add the MIT licence to the GitHub About section after the first push

## Next (upcoming phases, in order)

### Phase 1 — Plumbing proven
- [ ] `scripts/probe-gemini.ts`: list models, vision + JSON call, function-calling call, latency → choose `GEMINI_MODEL` / `GEMINI_FAST_MODEL`, record in README + docs/AI.md
- [ ] PayPal typed REST client: OAuth token cache, `PayPal-Request-Id` on every POST, `debug_id` in typed errors (use APIMatic Context Plugin / PayPal docs for shapes)
- [ ] Check the PayPal Agent Toolkit npm package; choose it or our own typed tool layer, write the ADR
- [ ] Receipts logger (method, path, status, debug_id, request id, timestamp)
- [ ] `/dev/health` (dev only): create + capture a $1 sandbox order, create + delete a draft invoice, show debug IDs

### Phase 2 — Capture + Read + Market check
- [ ] `/new`: camera (`<input capture>` + getUserMedia upgrade), upload, draw canvas (perfect-freehand), sample picker
- [ ] Client downscale (≤1600px, JPEG q≈0.8); image type sniffing, size/dimension caps
- [ ] `/api/v1/ai/read`: zod Read schema (incl. per-item `retail: { isBrandedProduct, searchQuery? }`) as `responseSchema`, backoff on 429, one repair attempt, `MOCK_AI`
- [ ] `/new/read`: photo + animated ink circles from boxes, items list (inline edit), intent stamp + reason, clarifying chips
- [ ] Math check (integer minor units) with ink-red underline; sanity checks (≤0, >100× median, duplicates); AUP classification
- [ ] Item crops as WebP in localStorage with size cap + LRU eviction
- [ ] Channel3 market check (server-only key, flagged items only, cap ~10, parallel + timeout, match confidence, 24 h cache)
- [ ] Market chips + offers sheet + suggested price + "Use product photo & specs" toggle
- [ ] Price guard ("$3.50 for AirPods? Did you mean $35?") with one-tap fix, wired into sanity checks
- [ ] Hidden (not broken) when `CHANNEL3_API_KEY` is unset or the call fails

### Phase 3 — Shop rail + Verify-to-record
- [ ] Stall from a Read; HMAC-signed lz-string URL payload (`/s#…`) with version + expiry; size caps
- [ ] Storefront `/s`: header in seller's ink, item cards with art, steppers, sticky cart, PayPal JS SDK buttons (re-check CSP against SDK docs)
- [ ] Orders v2 create (payee email, items + breakdown, custom_id, invoice_id) + capture, server recompute from signed payload
- [ ] `/receipt/[orderId]` with signed verify QR ("Show this to the seller")
- [ ] `/verify`: QR scan + counter mode + manual order ID; `verifyOrder(order, stall) → Verdict` (status, capture, payee, amount, currency, replay)
- [ ] Verify pass → ledger write + Paid moment (receipt print, Web Audio ka-ching, takings tick); fail → calm reason
- [ ] Unit tests for every verdict + replay; payload encode/decode/HMAC; money math
- [ ] Share card: link + QR + printable A5 "Scan to pay" poster

### Phase 4 — Invoice + Subscription
- [ ] Invoice side-by-side (paper ↔ PayPal preview, hover-linked lines), send, QR, `/i/[id]` live status with backoff
- [ ] Remind / cancel; a paid invoice writes the ledger only after PayPal confirms
- [ ] Catalog Product + Billing Plan (interval, optional trial), subscribe button (check v6 vs older SDK), status in studio

### Phase 5 — Agents
- [ ] Penny (`/api/ai/penny`): Gemini function-calling loop, typed tools incl. `check_market_price`, max steps, streaming
- [ ] Approval Cards (Approve / Edit / Reject) for every mutating tool; unit test that nothing mutates without approval
- [ ] Receipts drawer in studio
- [ ] Buyer concierge on `/s` (schema-constrained cart proposals; "is this a good price?" from stored range)
- [ ] (stretch) `/api/agent/stall`, `/api/agent/checkout`, MCP server at `/api/mcp`

### Phase 6 — Studio + finish
- [ ] Ledger: shadcn data table (TanStack Table), lazy-loaded; quick + status filter, CSV export, sticky header, mobile cards
- [ ] Overview, settings (payee, currency + FX, language, sound, theme), export/import JSON
- [ ] Samples in `/public/samples`: coffee cart, freelancer's bill, piano-lessons notice, phone-accessories stall, optional Spanish menu
- [ ] Judge quick path card; PWA manifest + icons; `/privacy`
- [ ] Playwright smoke (sample → Read → publish → storefront → order created)
- [ ] Lighthouse ≥ 90 mobile on `/` and `/s`
- [ ] OpenAPI at `/api/v1/openapi.json` + docs page; public Postman collection generated from it
- [ ] Security review vs §12 (header scanner, client-bundle secrets grep, `pnpm audit`)
- [ ] Deploy to Vercel; README + all docs current

## Done
- [x] Next.js 16.4.3 + pnpm + Tailwind v4 + shadcn/ui (Radix, Nova preset, restyled) — 2026-11-01 — `pnpm build` passes; components render on `/design`
- [x] Dependencies installed: zod, server-only, motion, lucide-react, sonner, vitest — 2026-11-01 — present in `package.json`; typecheck passes
- [x] "Ink & Ledger" tokens, Inter + Instrument Serif + Caveat via `next/font`, paper + blueprint dark mode — 2026-11-01 — viewed `/design` in both themes in the browser
- [x] zod env validation (`src/lib/env.ts`, server-only) incl. `CHANNEL3_API_KEY`; `.env.example` — 2026-11-01 — typecheck; `.env.example` committed, `.env*` ignored
- [x] Security headers + nonce CSP in `src/proxy.ts` — 2026-11-01 — `curl -I /design` shows CSP, Referrer-Policy, Permissions-Policy, nosniff, X-Frame-Options; no console CSP errors; `csp.test.ts`
- [x] `/design` page: tokens, type, buttons, cards, skeleton, ink circle, stamp — 2026-11-01 — viewed and replayed in browser
- [x] `src/core/{read,rails,verify,agent}` structure — 2026-11-01 — files exist
- [x] Vitest + first tests (CSP, ink path) — 2026-11-01 — `pnpm test`: 9 passed
- [x] GitHub Actions CI (gitleaks, lint, typecheck, test, build) — 2026-11-01 — workflow file written; **first run happens after push**
- [x] All §13 docs, MIT LICENSE, README skeleton, CHANGELOG — 2026-11-01 — files exist
- [x] `git init` + first commit — 2026-11-01 — `git log`

## Cut / parked (and why)
- AG Grid ledger — replaced by a shadcn/TanStack data table (see ADR-007).
- `cacheComponents` / partial prerendering — incompatible with nonce CSP (ADR-005).

## Known issues
- [ ] PayPal / Gemini / Channel3 credentials not in `.env.local` yet — blocks Phase 1 — add them yourself (never paste into chat)
- [ ] CI has not run yet (repo not pushed) — medium — push, then check the Actions tab
- [ ] CSP PayPal host list is from the classic SDK; re-verify against JS SDK v6 docs in Phase 3 — low
- [ ] `style-src` allows `'unsafe-inline'` (server-rendered style attributes can't carry a nonce) — low — scripts remain nonce-only
- [ ] Landing "Start with a photo" button is disabled until Phase 2 — expected

## Submission checklist
- [ ] Repo public, MIT LICENSE visible in About, no secrets in history (`gitleaks detect` + `git log -p | grep -i -E "secret|api_key"`)
- [ ] `docs/TASKS.md` shows no open critical issues; all docs match the shipped app
- [ ] Security headers verified on the live URL; client bundle grep for secrets is clean
- [ ] Live URL works in a private window on a phone; samples work; sandbox buyer login works
- [ ] Video < 3:00, public on YouTube, link on the form
- [ ] "Built with" lists the real tools only
- [ ] Testing instructions + sandbox credentials on the Devpost form too
- [ ] Opted into the **Channel3** sponsor prize (only one sponsor prize is allowed) and claimed the APIMatic participant subscription
- [ ] Submitted before **Thu 12 Nov, 8:00 PM IST** (hard deadline 13 Nov, 00:30 IST)
