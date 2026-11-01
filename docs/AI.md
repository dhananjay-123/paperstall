# AI

Paperstall uses Google Gemini (`@google/genai`). No AI code ships yet (Phase 0); this page records the design the
code will be held to, and is rewritten as each part lands.

## Models
Chosen in Phase 1 by `scripts/probe-gemini.ts` (vision, structured output, bounding boxes, function calling), with an
optional cheaper model for chat turns. The free-tier key means: one in-flight Read per client, exponential backoff
on 429, and images downscaled to ≤1600px before upload.

## Read schema (Phase 2)
Intent (`shop` / `invoice` / `subscription` / `unknown`) + one-sentence reason, business, source language, currency,
items with 0–1000 bounding boxes and confidence, optional customer and dates, written total, clarifying questions and
warnings. Each item also carries:

```ts
retail: { isBrandedProduct: boolean, searchQuery?: string }
```

The model sets `isBrandedProduct` only for branded, mass-produced goods (e.g. "Anker 10000mAh power bank"), never for
food, handmade or service items. Flagged items get a Channel3 market check.

Checks done in code, not by the model: totals (integer minor units), sanity (≤0, >100× median, duplicates), and the
market price guard.

## Penny tools (Phase 5)
`list_unpaid_invoices`, `get_invoice`, `send_invoice_reminder`, `cancel_invoice`, `get_order`, `refund_capture`,
`add_tracking`, `create_invoice_from_text`, `create_payment_link_for_items`, `sales_summary`,
`check_market_price` (Channel3, read-only).

Mutating tools (refund, send, remind, cancel, create) return a proposal; only the seller's *Approve* executes them.

## Safety
Images and chat text are untrusted data; instructions inside them are ignored. Tools are allow-listed, arguments
zod-validated, refunds capped at the captured amount, and tool steps per turn are limited.
