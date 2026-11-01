"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { PaidReceipt } from "@/components/paid/paid-receipt";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/core/money";
import type { Verdict } from "@/core/verify";
import { api, ApiCallError } from "@/lib/api-client";
import { kaching } from "@/lib/sound";
import { useStore } from "@/lib/store";

const Scanner = dynamic(() => import("@/components/verify/scanner").then((m) => m.Scanner), {
  ssr: false,
  loading: () => <div className="aspect-square w-full rounded-2xl ink-shimmer" />,
});

const stamp = () => Date.now();

type Result = { verdict: Verdict; at: number } | { error: string; debugId?: string; at: number };

export function VerifyClient({ initialStall }: { initialStall?: string }) {
  const allStalls = useStore((s) => s.stalls);
  const stalls = allStalls.filter((x) => x.intent === "shop");
  const ledger = useStore((s) => s.ledger);
  const addLedger = useStore((s) => s.addLedger);
  const sound = useStore((s) => s.settings.sound);
  const [stallId, setStallId] = useState(initialStall ?? stalls[0]?.id ?? "");
  const [counter, setCounter] = useState(false);
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const stall = stalls.find((s) => s.id === stallId);
  const takings = ledger.filter((l) => l.stallId === stallId && l.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).reduce((n, l) => n + l.totalMinor - (l.refundedMinor ?? 0), 0);

  if (!stalls.length) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-ink">No stall on this device</h1>
        <p className="text-muted-foreground">Scan to confirm works on the phone where you published your stall.</p>
        <Button variant="action" asChild>
          <Link href="/new">Make a stall</Link>
        </Button>
      </div>
    );
  }

  async function check(input: { code?: string; orderId?: string }) {
    if (!stall || busy) return;
    setBusy(true);
    const mine = ledger.filter((l) => l.stallId === stall.id);
    try {
      const { verdict } = await api<{ verdict: Verdict }>("/api/v1/verify", {
        body: {
          ...input,
          signed: stall.signed,
          recorded: {
            orderIds: mine.map((l) => l.id),
            captureIds: mine.flatMap((l) => (l.captureId ? [l.captureId] : [])),
            recordedAt: Object.fromEntries(mine.map((l) => [l.id, l.at])),
          },
        },
      });
      if (verdict.ok) {
        const wrote = addLedger({
          id: verdict.orderId,
          kind: "order",
          stallId: stall.id,
          at: verdict.paidAt ?? new Date().toISOString(),
          items: verdict.items.map((i) => ({ name: i.name, quantity: i.quantity })),
          currency: verdict.currency,
          totalMinor: verdict.totalMinor,
          status: "COMPLETED",
          captureId: verdict.captureId,
          verifiedVia: input.code ? "scan" : "manual",
        });
        if (!wrote) {
          setResult({ verdict: { ok: false, reason: "already_recorded", message: "Already recorded" }, at: stamp() });
        } else {
          if (sound) kaching();
          setResult({ verdict, at: stamp() });
        }
      } else {
        setResult({ verdict, at: stamp() });
      }
      setManual("");
    } catch (e) {
      setResult({ error: e instanceof ApiCallError ? e.error.message : "Couldn't reach PayPal. Try again.", debugId: e instanceof ApiCallError ? e.error.debugId : undefined, at: stamp() });
    } finally {
      setBusy(false);
      if (!counter) setCamera(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="font-serif text-4xl text-ink">Scan to confirm payment</h1>
        <p className="text-muted-foreground">A sale is recorded only after PayPal confirms it. Fake screenshots don&apos;t pass.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Stall</span>
          <select value={stallId} onChange={(e) => setStallId(e.target.value)} className="rounded-md border bg-background px-2 py-1">
            {stalls.map((s) => (
              <option key={s.id} value={s.id}>
                {s.payload.n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={counter} onChange={(e) => setCounter(e.target.checked)} className="size-4 accent-[var(--action)]" />
          Counter mode (keep camera open)
        </label>
        {stall ? <span className="ml-auto font-medium tabular-nums">Today: {formatMoney(takings, stall.payload.c)}</span> : null}
      </div>

      {result ? <ResultCard result={result} title={stall?.payload.n ?? "Paid"} /> : null}

      {camera ? (
        <Scanner paused={busy} onCode={(code) => void check({ code })} />
      ) : (
        <Button variant="action" size="lg" className="h-14 w-full text-base" onClick={() => setCamera(true)}>
          Scan the buyer&apos;s receipt
        </Button>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const id = manual.trim().toUpperCase();
          if (id) void check({ orderId: id });
        }}
      >
        <label className="sr-only" htmlFor="order-id">
          PayPal order ID
        </label>
        <input
          id="order-id"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="…or type a PayPal order ID"
          pattern="[A-Za-z0-9]{5,40}"
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 font-mono text-sm"
        />
        <Button type="submit" variant="outline" disabled={busy || !manual.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : null} Check
        </Button>
      </form>
    </div>
  );
}

function ResultCard({ result, title }: { result: Result; title: string }) {
  if ("error" in result) {
    return (
      <div role="alert" className="rounded-2xl border border-warning/50 bg-card p-5">
        <p className="font-serif text-2xl text-warning-ink">Couldn&apos;t check right now</p>
        <p className="text-sm">{result.error}</p>
        {result.debugId ? <p className="font-mono text-xs text-muted-foreground">debug_id {result.debugId}</p> : null}
      </div>
    );
  }
  const v = result.verdict;
  if (v.ok) {
    return (
      <div className="space-y-3">
        <p className="flex items-center justify-center gap-2 font-serif text-3xl text-success-ink" role="status">
          <CheckCircle2 className="size-7" /> Paid {formatMoney(v.totalMinor, v.currency)}
        </p>
        <PaidReceipt title={title} totalMinor={v.totalMinor} currency={v.currency} items={v.items} at={v.paidAt} orderId={v.orderId} playKey={result.at} />
      </div>
    );
  }
  const time = v.recordedAt ? ` at ${new Date(v.recordedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "";
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-danger/50 bg-card p-5">
      <XCircle className="size-8 shrink-0 text-danger-ink" />
      <div>
        <p className="font-serif text-3xl text-danger-ink">
          {v.message}
          {v.reason === "already_recorded" ? time : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          {v.reason === "not_paid"
            ? "PayPal hasn't completed this payment. Don't hand over the goods yet."
            : v.reason === "wrong_payee"
              ? "This payment went to a different PayPal account, not yours."
              : v.reason === "amount_mismatch" || v.reason === "currency_mismatch"
                ? "What was paid doesn't match your stall's prices."
                : v.reason === "already_recorded"
                  ? "This receipt was already used. Nothing new was recorded."
                  : "This order belongs to a different stall."}
        </p>
      </div>
    </div>
  );
}
