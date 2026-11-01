// Penny's tools and the approval gate. Tools that move money or contact a customer
// return a proposal; only an explicit seller approval executes them. Implemented in Phase 5.

export type ToolEffect = "read" | "mutate";
