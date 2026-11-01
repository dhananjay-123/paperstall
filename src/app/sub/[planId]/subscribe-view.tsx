"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2 } from "lucide-react";
import { PayPalButton } from "@/components/paypal/paypal-button";
import { Stamp } from "@/components/ink/stamp";
import { Qr } from "@/components/share/qr";
import { formatMoney } from "@/core/money";
import { api, ApiCallError } from "@/lib/api-client";
import { kaching } from "@/lib/sound";
import { useStore } from "@/lib/store";

type Plan = { id: string; name: string; description?: string; status: string; currency?: string; priceMinor?: number; interval?: string; trialCycles: number };

const noop = () => () => {};
const LABEL: Record<string, string> = { week: "WEEKLY", month: "MONTHLY", year: "YEARLY" };

export function SubscribeView({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const isOwner = useStore((s) => s.plans.some((p) => p.planId === planId));
  const url = useSyncExternalStore(noop, () => `${window.location.origin}/sub/${planId}`, () => "");

  useEffect(() => {
    let alive = true;
    api<Plan>(`/api/v1/plans/${planId}`)
      .then((p) => alive && setPlan(p))
      .catch((e) => alive && setError(e instanceof ApiCallError ? e.error.message : "Couldn't load this plan."));
    return () => {
      alive = false;
    };
  }, [planId]);

  if (error && !plan) return <p className="mx-auto max-w-md px-4 py-20 text-center text-danger-ink">{error}</p>;
  if (!plan) return <div className="mx-auto mt-10 h-72 max-w-md rounded-2xl ink-shimmer" />;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-10">
      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <Stamp kind="monthly" label={LABEL[plan.interval ?? "month"] ?? "PLAN"} />
        <h1 className="font-serif text-4xl text-ink">{plan.name}</h1>
        {plan.description ? <p className="text-muted-foreground">{plan.description}</p> : null}
        {plan.priceMinor !== undefined && plan.currency ? (
          <p className="font-serif text-3xl tabular-nums">
            {formatMoney(plan.priceMinor, plan.currency)} <span className="text-base text-muted-foreground">/ {plan.interval}</span>
          </p>
        ) : null}
        {plan.trialCycles ? <p className="text-sm text-success-ink">First {plan.trialCycles} {plan.interval}(s) free.</p> : null}
        {plan.status !== "ACTIVE" ? <p className="text-sm text-warning-ink">This plan isn&apos;t active right now.</p> : null}
        {done ? (
          <p role="status" className="flex items-center gap-2 text-success-ink">
            <CheckCircle2 className="size-5" /> Subscribed. PayPal will bill you each {plan.interval}. Subscription {done}.
          </p>
        ) : plan.status === "ACTIVE" && plan.currency ? (
          <PayPalButton
            kind="subscription"
            currency={plan.currency}
            onError={setError}
            createSubscription={() => api<{ subscriptionId: string }>("/api/v1/subscriptions", { body: { planId, brandName: plan.name } })}
            onApprove={async (subscriptionId) => {
              const s = await api<{ status: string }>("/api/v1/subscriptions", { body: { subscriptionId } });
              setDone(`${subscriptionId} (${s.status.toLowerCase()})`);
              const st = useStore.getState();
              const mine = st.plans.find((p) => p.planId === planId);
              if (mine) st.upsertPlan({ ...mine, subscriptionIds: [...new Set([...mine.subscriptionIds, subscriptionId])] });
              if (st.settings.sound) kaching();
            }}
          />
        ) : null}
        {error ? <p className="text-sm text-danger-ink">{error}</p> : null}
      </section>
      {isOwner && url ? (
        <section className="space-y-3 rounded-2xl border bg-card p-5 text-center">
          <h2 className="font-serif text-2xl text-ink">Share this plan</h2>
          <div className="flex justify-center">
            <Qr value={url} size={200} label={`QR code to subscribe to ${plan.name}`} />
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
        </section>
      ) : null}
    </div>
  );
}
