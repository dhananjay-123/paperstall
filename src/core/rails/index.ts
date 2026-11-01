// A rail turns an understood piece of paper into a real PayPal object.
// Adapters (shop → Orders v2, invoice → Invoicing v2, subscription → Catalog + Plans)
// land in Phases 3–4; new rails (Payouts, Donations) implement the same interface.

export type RailKind = "shop" | "invoice" | "subscription";

export interface Rail<Input, Output> {
  readonly kind: RailKind;
  create(input: Input): Promise<Output>;
}
