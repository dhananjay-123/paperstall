# Demo

Exact script, test data and sandbox accounts (never secrets). Flows are filled in as they ship.

## Sandbox accounts
- Merchant (business, US): `PAYPAL_DEMO_PAYEE_EMAIL` in `.env.local`
- Buyer (personal, US): published in the README for judges

## Paper props / samples
1. **Coffee cart chalkboard** with $ prices → SHOP
2. **Freelancer's handwritten bill** to a client, with one deliberate addition mistake → INVOICE + math check
3. **Piano-lessons notice**, "$120/month, 4 sessions" → SUBSCRIPTION (MONTHLY stamp)
4. **Phone-accessories stall price list** with real brands, one price deliberately mistyped → SHOP + market chips + price guard
5. (optional) **Spanish taco-stand menu** → translated storefront

## Video beats (target 2:45, hard max 2:59)
| Time | Beat |
|---|---|
| 0:00–0:12 | Hand writes "Latte $4 · Croissant $3" on a chalkboard |
| 0:12–0:20 | Title card: Paperstall — Draw it. Snap it. Get paid. |
| 0:20–0:50 | Photo → the Read (ink circles, SHOP stamp + reason); 3 s Spanish → English flash; publish → QR poster |
| 0:50–1:20 | Buyer scans → storefront → concierge → PayPal sandbox checkout → receipt QR → seller Scan to confirm → Paid; a fake screenshot is rejected |
| 1:20–1:30 | Phone-accessories list → market chips → "$3.50 for AirPods? Did you mean $35?" → one-tap fix |
| 1:30–1:45 | Freelancer's bill → math check → side-by-side → invoice sent → QR → paid |
| 1:45–1:55 | Lessons notice → MONTHLY → Product + Plan → subscribe button |
| 1:55–2:25 | Penny: "Who hasn't paid? Remind them." → Approval Card → Receipts with debug IDs; partial refund |
| 2:25–2:35 | Built to integrate: OpenAPI docs, rail adapters, INTEGRATE.md |
| 2:35–2:45 | (if built) Claude Desktop buys coffee via MCP → approval link |
| 2:45–2:55 | Close: who it's for, "every PayPal object you saw was real, in the sandbox", URL + repo |
