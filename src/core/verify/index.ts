// PayPal order + stall → Verdict. A sale enters the ledger only on a pass (ADR-003).
// Implemented in Phase 3.

export type VerdictReason =
  | "not_paid"
  | "wrong_payee"
  | "amount_mismatch"
  | "currency_mismatch"
  | "already_recorded";
