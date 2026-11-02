"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { PaidReceipt } from "@/components/paid/paid-receipt";
import { EmptyBoard } from "@/components/empty-board";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/core/money";
import type { Verdict } from "@/core/verify";
import { ApiCallError } from "@/lib/api-client";
import { announceCounted, checkOrder, countedElsewhere } from "@/lib/doorbell-client";
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
  // Stalls arrive from localStorage after the first render, so derive the choice rather than
  // freezing it in state: without ?stall= the first stall is picked once it loads.
  const [picked, setStallId] = useState(initialStall ?? "");
  const [counter, setCounter] = useState(false);
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const stall = stalls.find((s) => s.id === picked) ?? stalls[0];
  const stallId = stall?.id ?? "";
  const takings = ledger.filter((l) => l.stallId === stallId && l.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).reduce((n, l) => n + l.totalMinor - (l.refundedMinor ?? 0), 0);

  if (!stalls.length) {
    return (
      <EmptyBoard
        title="No stall on this phone yet"
        body="Payments are checked on the phone that published the stall, because only the seller can count a sale. Make a stall here first."
        action="Make a stall"
        href="/new"
      />
    );
  }

  async function check(input: { code?: string; orderId?: string }) {
    if (!stall || busy) return;
    setBusy(true);
    try {
      // Orders the live counter (or another phone) already counted must not count twice.
      const elsewhere = stall.doorbell ? await countedElsewhere(stall.doorbell) : undefined;
      const { verdict, pickupCode, payer } = await checkOrder(stall, ledger, input, elsewhere);
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
          pickupCode,
          payer,
        });
        if (wrote && stall.doorbell) announceCounted(stall.doorbell, verdict.orderId);
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
      {stall?.doorbell ? (
        <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          Selling from a laptop or tablet?{" "}
          <Link href={`/counter?stall=${stall.id}`} className="font-medium text-action underline underline-offset-2">
            Open the live counter
          </Link>{" "}
          and paid orders appear on their own, no scanning.
        </p>
      ) : null}

      {result ? <ResultCard result={result} title={stall?.payload.n ?? "Paid"} stallId={stall?.id} /> : null}

      {camera ? (
        <Scanner paused={busy} onCode={(code) => void check({ code })} />
      ) : (
        <Button variant="action" size="lg" className="h-14 w-full text-base" onClick={() => setCamera(true)}>
          {result ? "Scan the next receipt" : "Scan the buyer’s receipt"}
        </Button>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          // Order IDs may be typed in groups ("6VU2 9750 …"). Anything longer is a receipt code from a handheld QR scanner.
          const raw = manual.trim();
          const id = raw.replace(/[\s-]/g, "").toUpperCase();
          if (/^[A-Z0-9]{5,40}$/.test(id)) void check({ orderId: id });
          else if (raw) void check({ code: raw });
        }}
      >
        <label className="sr-only" htmlFor="order-id">
          PayPal order ID
        </label>
        <input
          id="order-id"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="…or type the order ID from their receipt"
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 font-mono text-sm"
        />
        <Button type="submit" variant="outline" disabled={busy || !manual.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : null} Check
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Selling from a laptop? The customer can hold their phone up to your webcam, or read out the order ID printed under their QR code. A USB QR scanner
        works too: click the box above and scan.
      </p>
    </div>
  );
}

function ResultCard({ result, title, stallId }: { result: Result; title: string; stallId?: string }) {
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
        <p className="text-center text-sm text-muted-foreground">
          Saved to your ledger. Hand over the order.
          {stallId ? (
            <>
              {" "}
              <Link href={`/studio/${stallId}`} className="text-action underline">
                Open the ledger
              </Link>
            </>
          ) : null}
        </p>
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
