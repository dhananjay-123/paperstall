"use client";

import Link from "next/link";
import { ShareCard } from "@/components/share/share-card";
import { formatMoney } from "@/core/money";
import type { Stall } from "@/core/stall";
import { useStore } from "@/lib/store";

export function Overview({ stall }: { stall: Stall }) {
  const ledger = useStore((s) => s.ledger);
  const invoices = useStore((s) => s.invoices);
  const today = new Date().toDateString();
  const mine = ledger.filter((l) => l.stallId === stall.id);
  const todays = mine.filter((l) => new Date(l.at).toDateString() === today);
  const takings = todays.reduce((n, l) => n + l.totalMinor - (l.refundedMinor ?? 0), 0);
  const pending = invoices.filter((i) => !["PAID", "MARKED_AS_PAID", "CANCELLED", "REFUNDED"].includes(i.status));
  const recent = [...ledger].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  const m = stall.metrics;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Today's takings" value={formatMoney(takings, stall.payload.c)} note={`${todays.length} verified sale${todays.length === 1 ? "" : "s"}`} />
        <Stat label="Pending invoices" value={String(pending.length)} note={pending.length ? "waiting for payment" : "all settled"} />
        <Stat
          label="Photo → published"
          value={m?.photoToPublishMs ? `${Math.round(m.photoToPublishMs / 1000)}s` : "—"}
          note={m?.editsPerItem !== undefined ? `${m.editsPerItem} edits per item after the Read` : "measured on this device"}
        />
      </div>

      <ShareCard stallId={stall.id} signed={stall.signed} name={stall.payload.n} />

      <section className="space-y-2">
        <h2 className="font-serif text-2xl text-ink">Latest</h2>
        {recent.length ? (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{formatMoney(l.totalMinor, l.currency)}</span> · {l.items.map((i) => `${i.quantity} ${i.name}`).join(", ")}
                </span>
                <span className="shrink-0 text-muted-foreground">{new Date(l.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No sales yet. Keep the{" "}
            <Link className="text-action underline" href={`/counter?stall=${stall.id}`}>
              live counter
            </Link>{" "}
            open and paid orders appear by themselves, or{" "}
            <Link className="text-action underline" href={`/verify?stall=${stall.id}`}>
              scan a receipt
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-serif text-4xl text-ink tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
