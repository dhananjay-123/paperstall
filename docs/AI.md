# AI

Paperstall uses Google Gemini through `@google/genai`, plus Channel3 for market prices.

## Models
Chosen with `pnpm probe:gemini` (lists models, then times one vision+JSON+box call and one function-calling call) on 2026-11-02:

| Use | Model | Why |
|---|---|---|
| Read (vision, structured output, boxes) | `gemini-3-flash-preview` | Passed both probes reliably (vision+JSON ≈2.3 s, tools ≈1.6 s); accurate boxes |
| Fast: concierge, acceptable-use check, Penny | `gemini-3.5-flash-lite` | Fastest that passed both probes (tools ≈0.7 s) |

Newer flash models were returning 503 overloads during the probe; both choices are env-overridable (`GEMINI_MODEL`, `GEMINI_FAST_MODEL`).

**Fallback.** When the chosen model answers 503 (overloaded), 429 or times out, `generate` tries `gemini-3.5-flash` once (`GEMINI_FALLBACK_MODEL`). A free-tier *daily* cap ("per day" in the 429) is not retried on the same model: if the fallback is capped too, the Read says "Today's free AI reads are used up" and offers the cached sample instead of counting down. Every upstream failure is logged on the server as `[gemini] model note → status`.

## The Read
- Prompt: `src/core/read/prompt.ts`. Schema: `src/core/read/schema.ts` (zod), sent as `responseJsonSchema`.
- Output: intent + one-sentence reason, business, source language, currency (with confidence), items (original + English name, unit price, quantity, interval, 0–1000 box, confidence, `retail`), customer, dates, written total and its box, notes, up to 3 clarifying questions, warnings.
- `retail: { isBrandedProduct, searchQuery? }` is set only for branded, mass-produced goods; it drives the market check.
- **Gemini schema subset:** Gemini's structured output rejected our schema with a 400 until we stripped `minItems`/`maxItems` (plus `$schema`, `additionalProperties`, `min/maxLength`). `toGeminiSchema` removes them; zod re-validates every limit on the response.
- One repair attempt: if the JSON fails zod, the model sees its errors once; a second failure is an honest error.
- Images are sniffed by magic bytes (JPEG/PNG/WebP), capped at 4 MB, downscaled on the client to ≤1600 px.

## Checks done in code, not by the model
- **Math check:** totals recomputed in integer cents; a mismatch with the written total draws a red ink circle on the paper and a calm warning.
- **Sanity:** zero/negative prices block publishing; >100× the median and duplicates warn.
- **Acceptable use:** a separate text-only classification on the fast model flags items PayPal prohibits; flagged items block publishing with a link to the policy. If the check fails, the UI says it didn't run.

## Market check (Channel3)
`POST https://api.trychannel3.com/v1/search` for flagged items only (max 10, parallel, 8 s timeout). `src/core/market.ts` scores matches by token overlap, and **a different model number is never a match** (JBL Go 3 ≠ Go 4). Channel3 often returns one product as several entries with one store each, so offers are pooled across every entry that scores within 0.05 of the best match (a near miss such as "AirPods Max 2" for "AirPods Pro 2" stays out). A range needs at least two same-currency, new-condition listings, and the offers sheet shows each store once at its cheapest price. Channel3 covers US stores in USD, so stalls priced in other currencies get no chip. The UI shows a chip with the range and store count, an offers sheet, a suggested price (5% under the median), an opt-in product photo, and a price guard when the written price is under 25% or over 300% of the median ("$3.50 for AirPods? Did you mean $169.00?"), trying decimal-shift fixes first. Listings for accessories (cases, covers, skins, "compatible", "… for AirPods") are dropped unless the seller's item is itself an accessory. The guard speaks only on a strong match (≥ 0.85) with at least three stores near the median, uses the seller's own item name, and calls a high price a slip only when a decimal shift lands inside the market (a real $199 pair of AirPods next to $25 cases stays quiet). Results are cached per query for 24 h on the device. With no key, or on any failure, the chips just don't appear.

## Penny (agent)
- Route: `src/app/api/v1/ai/penny/route.ts`. Tools and the approval gate: `src/core/agent`.
- Read tools run on the server: `list_unpaid_invoices`, `list_orders`, `get_invoice`, `get_order`, `sales_summary`, `check_market_price`. `list_orders` gives the ledger's numbered orders with line items and unit prices (taken from the signed stall).
- Orders are resolved on the server: "the last order", "order 3", "#3" or a PayPal ID becomes the real PayPal order before any card exists, and a refund for named items ("one horchata") is the sum of those lines; an explicit amount wins. If the order or item can't be matched, Penny gets the error instead of a proposal, and her reply never mentions a card that wasn't made.
- Penny answers within a 12 s budget (low thinking, one fallback model); past that she says the AI is busy instead of spinning.
- Mutating tools only produce proposals: `send_invoice_reminder`, `cancel_invoice`, `refund_capture`, `add_tracking`, `create_invoice_from_text`, `create_payment_link_for_items`. There is no executor for them in the agent module. The studio renders an Approval Card (what, amount, recipient, exact PayPal endpoint; Approve / Edit / Reject), and only Approve calls the same approval-gated route the UI uses.
- Max 5 tool steps per turn. Gemini 3 requires its thought signatures on function-call turns, so the loop echoes the model's own turn back verbatim.
- Approval Cards are built once per reply and keyed by proposal id, so an approved card stays on its result (refund id and PayPal debug_id) and never offers Approve again. The refund amount field accepts only a positive amount with the currency's decimals, up to what is left to refund; the card header and the PayPal call update as you edit.
- Unit tests prove every mutating tool returns a proposal and calls no executor, that unknown tools and invalid arguments run nothing, and that order and item references resolve to the right order and amount.
- Replies are returned whole, not streamed.

## Buyer concierge
Fast model, prompt constrained to the stall's items by id; the server drops any id not on the stall, and the buyer confirms before anything goes in the cart. Notes ("oat milk") travel as order item descriptions. "Is this a good price?" is answered only from the stored market range.

## Safety
Images, buyer and seller text are data, not instructions (stated in every prompt). Tools are allow-listed and zod-validated; refunds are capped at the captured amount; AI routes are rate-limited per IP; `MOCK_AI=1` exists for local development and is refused in production.
