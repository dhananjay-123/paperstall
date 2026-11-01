# Integrating Paperstall

How a platform (PayPal, a POS, a marketplace) could adopt Paperstall. Sections marked _planned_ describe the
design, not shipped code.

## Today
- Logic is being built in `src/core/*` (read, rails, verify, agent) with no Next.js imports; the web app is one consumer.
- Each PayPal product sits behind a `Rail` interface (`src/core/rails`), so new rails (Payouts, Donations) plug in.

## Planned
- **Versioned HTTP API** (`/api/v1/...`) with an OpenAPI spec generated from the zod schemas, a docs page, and a public **Postman collection** generated from the spec (sandbox environment, no secrets).
- **Embeddable "Snap to sell" widget**: a `<script>` / iframe a website or POS could drop in.
- **Agent-ready stalls**: machine-readable stall + checkout endpoints and an MCP server; an agent can build a cart, a human approves the payment.

## Real-world path
- **Seller onboarding**: PayPal partner / multiparty onboarding replaces the typed payee email.
- **Sync**: verified webhooks + a small store for cross-device ledgers.
- **Distribution**: share to WhatsApp / Instagram; offline capture queue; more languages.
- **Sandbox → live**: live credentials, live webhook IDs, real FX source instead of a seller-set rate.

## Why PayPal benefits
Paper-based sellers get onto PayPal in under a minute with no forms; the AI picks the right PayPal product; every
sale is verified against PayPal before it's recorded; and stalls are ready for agentic commerce.
