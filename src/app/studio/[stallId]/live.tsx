"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useSyncExternalStore } from "react";
import { ArrowRight, Banknote, Check, CircleAlert, CircleCheck, Printer, RotateCcw, ScanLine, Search, ShieldCheck, ShoppingBag, Trophy, Undo2 } from "lucide-react";
import { InkCircle } from "@/components/ink/ink-circle";
import { LogoMark } from "@/components/logo";
import { Qr } from "@/components/share/qr";
import { stallUrl } from "@/components/share/share-card";
import { Button } from "@/components/ui/button";
import { formatPickup } from "@/core/doorbell";
import { formatMoney } from "@/core/money";
import type { Stall } from "@/core/stall";
import { useStore, type LedgerEntry } from "@/lib/store";
import type { CounterIssue } from "@/lib/use-live-counter";
import { cn } from "@/lib/utils";

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const noop = () => () => {};

/** A heading with a hand-drawn chalk underline. */
export function InkHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="relative w-fit pb-1.5 text-2xl font-extrabold tracking-[-0.03em] text-ink sm:text-[1.75rem]">
      {children}
      <svg aria-hidden viewBox="0 0 120 8" preserveAspectRatio="none" className="absolute -bottom-0.5 left-0 h-2 w-[105%] text-chalk">
        <path d="M2 5.5 C 30 2, 70 1.5, 118 4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </h2>
  );
}

export function LiveOrders({ stall, issues, fresh, retry }: { stall: Stall; issues: CounterIssue[]; fresh: string | null; retry: (id: string) => void }) {
  const ledger = useStore((s) => s.ledger);
  const patchLedger = useStore((s) => s.patchLedger);
  const mine = ledger.filter((l) => l.stallId === stall.id);
  const todays = mine.filter((l) => isToday(l.at));
  const takings = todays.reduce((n, l) => n + l.totalMinor - (l.refundedMinor ?? 0), 0);
  const counts = new Map<string, number>();
  for (const l of todays) for (const i of l.items) counts.set(i.name, (counts.get(i.name) ?? 0) + i.quantity);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const waiting = mine.filter((l) => l.verifiedVia === "doorbell" && !l.handedAt).sort((a, b) => b.at.localeCompare(a.at));
  const handed = mine.filter((l) => l.handedAt && isToday(l.handedAt)).sort((a, b) => b.handedAt!.localeCompare(a.handedAt!)).slice(0, 5);
  const newest = fresh ?? waiting[0]?.id;

  return (
    <section aria-labelledby="live-h" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <InkHeading id="live-h">Live orders</InkHeading>
        <dl className="grid w-full grid-cols-3 gap-2 sm:w-auto">
          <Stat icon={<Banknote />} value={formatMoney(takings, stall.payload.c)} label="Today’s takings" />
          <Stat icon={<ShoppingBag />} value={String(todays.length)} label="Orders today" />
          <Stat icon={<Trophy />} value={best ?? "—"} label="Best seller" />
        </dl>
      </div>

      {!stall.doorbell ? (
        <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
          This stall was published before live orders existed.{" "}
          <Link href="/new" className="font-medium text-action underline underline-offset-2">
            Publish it again
          </Link>{" "}
          to get a link that rings this screen. Until then,{" "}
          <Link href={`/verify?stall=${stall.id}`} className="font-medium text-action underline underline-offset-2">
            scan receipts
          </Link>
          .
        </p>
      ) : null}

      {issues.length ? (
        <ul className="space-y-2" aria-label="Notifications that didn't check out">
          {issues.map((i) => (
            <li key={i.orderId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warning/50 bg-card px-4 py-2.5 text-sm">
              <CircleAlert className="size-4 shrink-0 text-warning-ink" />
              <span>
                Order <span className="font-mono">{i.orderId}</span> wasn’t counted: {i.message}.
              </span>
              {i.retry ? (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => retry(i.orderId)}>
                  <RotateCcw /> Check again
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {waiting.length ? (
        <ul className="grid gap-5 px-2 pt-2 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {waiting.map((o) => (
              <OrderCard key={o.id} order={o} highlight={o.id === newest} onHanded={() => patchLedger(o.id, { handedAt: new Date().toISOString() })} />
            ))}
          </AnimatePresence>
        </ul>
      ) : stall.doorbell ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center">
          <p className="font-hand text-3xl text-action dark:text-chalk">waiting for the next order</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Customers scan your poster and pay on their own phone. Each paid order appears here by itself, after Paperstall has checked it with PayPal.
          </p>
          <Button variant="ghost" size="sm" className="mt-3" asChild>
            <Link href={`/verify?stall=${stall.id}`}>
              <ScanLine /> Or scan a receipt
            </Link>
          </Button>
        </div>
      ) : null}

      {handed.length ? (
        <details className="group rounded-xl border bg-card text-sm">
          <summary className="cursor-pointer list-none px-4 py-2.5 font-medium text-muted-foreground marker:hidden">Handed over today ({handed.length})</summary>
          <ul className="divide-y border-t">
            {handed.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-14 font-mono font-semibold">{o.pickupCode ? formatPickup(o.pickupCode) : "—"}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</span>
                <span className="tabular-nums">{formatMoney(o.totalMinor, o.currency)}</span>
                <Button size="icon-sm" variant="ghost" aria-label={`Put order ${o.pickupCode ?? o.id} back in the queue`} onClick={() => patchLedger(o.id, { handedAt: undefined })}>
                  <Undo2 />
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border bg-card px-3 py-2">
      <span className="hidden size-8 shrink-0 place-items-center rounded-full bg-accent text-ink sm:grid [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <dd className="truncate text-base leading-tight font-bold tracking-tight text-ink tabular-nums sm:text-lg">{value}</dd>
        <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      </div>
    </div>
  );
}

function OrderCard({ order, highlight, onHanded }: { order: LedgerEntry; highlight: boolean; onHanded: () => void }) {
  const reduce = useReducedMotion();
  const refunded = order.refundedMinor ?? 0;
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="relative flex flex-col rounded-2xl border bg-card p-5 shadow-[0_10px_30px_-20px_rgb(0_30_80/0.35)]"
    >
      {highlight ? <InkCircle box={[0, 0, 1000, 1000]} seed={7} color="var(--highlight)" blend={false} strokeWidth={2.4} /> : null}
      <div className="flex items-center justify-between gap-2 text-sm">
        {refunded ? (
          <span className="flex items-center gap-1.5 font-semibold text-warning-ink">
            <Undo2 className="size-4" /> {refunded >= order.totalMinor ? "Refunded" : `Partly refunded ${formatMoney(refunded, order.currency)}`}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-semibold text-success-ink">
            <CircleCheck className="size-4" /> Paid via PayPal
          </span>
        )}
        <span className="text-muted-foreground tabular-nums">{clock(order.at)}</span>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="min-w-0 sm:border-r sm:pr-4">
          <p className="max-w-[8rem] truncate text-2xl leading-tight font-extrabold tracking-tight">{order.payer ?? "Customer"}</p>
          <p className="mt-1 w-fit rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-ink" aria-label="Pickup code">
            {order.pickupCode ? formatPickup(order.pickupCode) : "—"}
          </p>
        </div>
        <ul className="order-last col-span-2 min-w-0 space-y-0.5 sm:order-none sm:col-span-1 sm:pt-1">
          {order.items.map((i) => (
            <li key={i.name} className="truncate">
              <span className="font-semibold tabular-nums">{i.quantity} ×</span> {i.name}
            </li>
          ))}
        </ul>
        <p className="text-3xl font-extrabold tracking-tight text-ink tabular-nums">{formatMoney(order.totalMinor, order.currency)}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1 text-xs font-medium text-action dark:text-sky">
          <ShieldCheck className="size-3.5" /> Checked with PayPal
        </span>
        <Button
          size="lg"
          variant={highlight ? "default" : "outline"}
          className={cn("h-10 rounded-full px-5", highlight && "bg-ink text-primary-foreground hover:bg-ink/90 dark:bg-chalk dark:text-slate dark:hover:bg-chalk/90")}
          onClick={onHanded}
        >
          <Check /> Handed over
        </Button>
      </div>
    </motion.li>
  );
}

const STATUS: Record<string, { label: string; dot: string }> = {
  COMPLETED: { label: "Paid", dot: "bg-success" },
  PAID: { label: "Paid", dot: "bg-success" },
  PARTIALLY_REFUNDED: { label: "Part-refunded", dot: "bg-warning" },
  REFUNDED: { label: "Refunded", dot: "bg-danger" },
};

export function LedgerPreview({ stallId, onOpen }: { stallId: string; onOpen: () => void }) {
  const ledger = useStore((s) => s.ledger);
  const [q, setQ] = useState("");
  const rows = ledger
    .filter((l) => l.stallId === stallId)
    .filter((l) => !q || l.items.some((i) => i.name.toLowerCase().includes(q.toLowerCase())) || l.id.includes(q.toUpperCase()))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);
  return (
    <section aria-labelledby="ledger-h" className="flex flex-col rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ledger-h" className="text-lg font-extrabold tracking-tight text-ink">
          Sales ledger
        </h2>
        <label className="relative">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders…" className="w-40 rounded-lg border bg-background py-1.5 pr-2 pl-8 text-sm" />
        </label>
      </div>
      {rows.length ? (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="pb-1.5 font-medium">Time</th>
              <th className="pb-1.5 font-medium">Items</th>
              <th className="pb-1.5 text-right font-medium">Total</th>
              <th className="pb-1.5 pl-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((l) => {
              const s = STATUS[l.refundedMinor ? (l.refundedMinor >= l.totalMinor ? "REFUNDED" : "PARTIALLY_REFUNDED") : l.status] ?? { label: l.status.toLowerCase(), dot: "bg-muted-foreground" };
              return (
                <tr key={l.id}>
                  <td className="py-2 pr-2 whitespace-nowrap tabular-nums">{clock(l.at)}</td>
                  <td className="max-w-0 truncate py-2 pr-2">{l.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</td>
                  <td className="py-2 text-right whitespace-nowrap tabular-nums">{formatMoney(l.totalMinor, l.currency)}</td>
                  <td className="py-2 pl-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={cn("size-2 rounded-full", s.dot)} />
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 flex-1 text-sm text-muted-foreground">{q ? "No sales match that." : "Sales appear here once PayPal confirms them."}</p>
      )}
      <Button variant="ghost" size="sm" className="mt-2 self-start" onClick={onOpen}>
        Open the full ledger <ArrowRight />
      </Button>
    </section>
  );
}

export function MyStallCard({ stall }: { stall: Stall }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = origin ? stallUrl(origin, stall.signed) : "";
  return (
    <section aria-labelledby="mystall-h" className="flex flex-col rounded-2xl border bg-card p-4">
      <h2 id="mystall-h" className="text-lg font-extrabold tracking-tight text-ink">
        My stall
      </h2>
      <div className="mt-3 flex flex-1 items-center justify-center gap-3">
        {stall.sourceImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- the seller's own thumbnail (data URL)
          <img src={stall.sourceImage} alt="The paper this stall was made from" className="h-28 w-auto -rotate-3 rounded-md border object-cover shadow-md" />
        ) : (
          <div className="grid h-28 w-24 -rotate-3 place-items-center rounded-md bg-slate p-2 text-center font-hand text-lg leading-tight text-chalk shadow-md">{stall.payload.n}</div>
        )}
        <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
        <div className="w-28 rotate-2 rounded-md border bg-white p-2 text-center text-[#003087] shadow-md">
          <p className="flex items-center justify-center gap-1 text-[11px] font-extrabold tracking-tight">
            <LogoMark className="h-3.5 w-auto" /> Paperstall
          </p>
          {url ? <Qr value={url} size={88} label={`QR code for ${stall.payload.n}`} className="mx-auto mt-1" /> : <div className="mx-auto mt-1 size-[88px] ink-shimmer" />}
          <p className="mt-0.5 text-[10px] font-semibold">Scan to order</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/studio/${stall.id}/poster`}>
            <Printer /> Print QR
          </Link>
        </Button>
        {url ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener">
              Open as a buyer
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
