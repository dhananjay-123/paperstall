# Changelog

## Phase 0 — Scaffold (2026-11-01)
- Next.js 16.4.3 (App Router, TypeScript strict), pnpm, Tailwind CSS v4, shadcn/ui (Radix), restyled.
- "Ink & Ledger" design tokens; Inter, Instrument Serif and Caveat via `next/font`; paper (light) and blueprint (dark) themes with a no-flash theme script.
- zod-validated server env incl. `CHANNEL3_API_KEY`; `.env.example`.
- Nonce CSP and security headers in `src/proxy.ts`; `cacheComponents` turned off for per-request nonces.
- `src/core/{read,rails,verify,agent}` structure.
- `/design` page: palette, type, buttons, cards, "ink is drying" skeleton, self-drawing ink circle, rubber stamp.
- Vitest with CSP and ink-path tests; GitHub Actions CI (gitleaks, lint, typecheck, test, build).
- Docs for the updated plan: Channel3 market check, verify-to-record, shadcn data-table ledger, global audience.
- MIT LICENSE, README skeleton.
