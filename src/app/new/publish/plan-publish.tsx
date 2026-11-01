"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Stamp } from "@/components/ink/stamp";
import { Button } from "@/components/ui/button";
import { formatMoney, toMinor } from "@/core/money";
import { api, ApiCallError } from "@/lib/api-client";
import { useStore } from "@/lib/store";
import { effectiveCurrency } from "../read/read-client";

const LABEL = { week: "WEEKLY", month: "MONTHLY", year: "YEARLY" } as const;

export function PlanPublish() {
  const router = useRouter();
  const draft = useStore((s) => s.draft)!;
  const read = draft.read!;
  const currency = effectiveCurrency(draft)!;
  const { upsertPlan, setDraft } = useStore.getState();
  const first = read.items.find((i) => i.unitPrice > 0);
  const [name, setName] = useState(first?.nameEn ?? read.business.name ?? "");
  const [price, setPrice] = useState(first?.unitPrice ?? 0);
  const [interval, setInterval] = useState<"week" | "month" | "year">(first?.interval ?? "month");
  const [description, setDescription] = useState(first?.description ?? read.business.name ?? "");
  const [trial, setTrial] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const priceMinor = toMinor(price, currency);
      const res = await api<{ productId: string; planId: string }>("/api/v1/plans", {
        body: { name: name.trim(), description: description.trim() || undefined, currency, priceMinor, interval, trialCycles: trial || undefined },
      });
      upsertPlan({
        stallId: draft.id,
        productId: res.productId,
        planId: res.planId,
        name: name.trim(),
        currency,
        priceMinor,
        interval,
        createdAt: new Date().toISOString(),
        subscriptionIds: [],
      });
      setDraft(null);
      router.push(`/sub/${res.planId}?created=1`);
    } catch (e) {
      setError(e instanceof ApiCallError ? `${e.error.message}${e.error.debugId ? ` (debug_id ${e.error.debugId})` : ""}` : "Couldn't create the plan.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-hand text-xl text-action">step 3 of 3</p>
        <h1 className="font-serif text-4xl text-ink">Create the plan</h1>
        <p className="text-muted-foreground">Customers subscribe once and PayPal bills them every {interval}.</p>
      </header>
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <Stamp kind="monthly" label={LABEL[interval]} />
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 font-serif text-xl text-ink" aria-label="Plan name" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium">Price ({currency})</span>
            <input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2 tabular-nums" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Every</span>
            <select value={interval} onChange={(e) => setInterval(e.target.value as typeof interval)} className="w-full rounded-lg border bg-background px-3 py-2">
              <option value="week">week</option>
              <option value="month">month</option>
              <option value="year">year</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Free trial ({interval}s)</span>
            <input type="number" min="0" max="3" step="1" value={trial} onChange={(e) => setTrial(Math.max(0, Math.min(3, Math.round(Number(e.target.value)))))} className="w-full rounded-lg border bg-background px-3 py-2" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Short description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} className="w-full rounded-lg border bg-background px-3 py-2" placeholder="4 sessions a month, 45 minutes each" />
        </label>
      </div>
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        PayPal creates a Catalog Product and an active Billing Plan at {price > 0 ? formatMoney(toMinor(price, currency), currency) : "—"} per {interval}.
        <span className="ml-1 font-mono text-xs">POST /v1/catalogs/products → /v1/billing/plans</span>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
      <Button variant="action" size="lg" disabled={busy || !(price > 0) || !name.trim()} onClick={create}>
        {busy ? <Loader2 className="animate-spin" /> : null} Create plan
      </Button>
    </div>
  );
}
