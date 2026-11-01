# PayPal integration

Every PayPal endpoint and SDK Paperstall uses, where it lives, and sandbox quirks found.
All calls run against **sandbox** (`https://api-m.sandbox.paypal.com`).

| Product | Endpoint / SDK | Purpose | File | Status |
|---|---|---|---|---|
| — | — | — | — | No PayPal calls yet (Phase 0). |

## How API shapes are checked
Request and response shapes are taken from the official PayPal docs, with the APIMatic Context Plugin (and the PayPal AI
Toolkit where available) used as a dev tool while building. Where a doc and our plan disagree, the doc wins and the
difference is noted below.

## Conventions
- Every POST sends a `PayPal-Request-Id` for idempotency.
- Errors surface PayPal's `debug_id`.
- Every call is logged to the local Receipts drawer.

## Sandbox quirks found
- (none yet)
