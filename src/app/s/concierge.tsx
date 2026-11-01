"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StallPayload } from "@/core/stall";
import { api, ApiCallError } from "@/lib/api-client";

type Proposal = { lines: { id: string; qty: number; note?: string }[]; explanation: string };

/** "Ask the stall": the AI proposes a cart from this stall's items only; the buyer confirms. */
export function Concierge({ stall, onPropose }: { stall: StallPayload; onPropose: (cart: Record<string, number>, notes: Record<string, string>) => void }) {
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signed = typeof window === "undefined" ? "" : decodeURIComponent(window.location.hash.slice(1));
  const name = (id: string) => stall.i.find((i) => i.id === id)?.name ?? id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ask.trim().length < 2) return;
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      setProposal(await api<Proposal>("/api/v1/ai/concierge", { body: { signed, ask: ask.trim() } }));
    } catch (err) {
      setError(err instanceof ApiCallError ? err.error.message : "The stall assistant isn't available right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Ask the stall" className="rounded-xl border bg-card p-3">
      <form onSubmit={submit} className="flex gap-2">
        <label className="sr-only" htmlFor="ask">
          Ask the stall
        </label>
        <input
          id="ask"
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          maxLength={300}
          placeholder="Ask the stall: “2 lattes, one with oat milk, and something sweet”"
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Ask
        </Button>
      </form>
      {error ? <p className="mt-2 text-sm text-danger-ink">{error}</p> : null}
      {proposal ? (
        <div aria-live="polite" className="mt-3 space-y-2 text-sm">
          <p>{proposal.explanation}</p>
          {proposal.lines.length ? (
            <>
              <ul className="text-muted-foreground">
                {proposal.lines.map((l) => (
                  <li key={l.id}>
                    {l.qty} × {name(l.id)}
                    {l.note ? ` (${l.note})` : ""}
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="action"
                onClick={() => {
                  // The model may split one item into lines ("1 latte with oat milk" + "1 latte"): sum them.
                  const cart: Record<string, number> = {};
                  const notes: Record<string, string> = {};
                  for (const l of proposal.lines) {
                    cart[l.id] = Math.min(99, (cart[l.id] ?? 0) + l.qty);
                    if (l.note) notes[l.id] = [notes[l.id], `${l.qty}× ${l.note}`].filter(Boolean).join("; ").slice(0, 100);
                  }
                  onPropose(cart, notes);
                  setProposal(null);
                  setAsk("");
                }}
              >
                Put this in my cart
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
