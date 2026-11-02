"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyBoard } from "@/components/empty-board";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/core/money";
import { useStore } from "@/lib/store";

export function StudioIndex() {
  const stalls = useStore((s) => s.stalls);
  const invoices = useStore((s) => s.invoices);
  const plans = useStore((s) => s.plans);
  const empty = !stalls.length && !invoices.length && !plans.length;

  if (empty) {
    return (
      <EmptyBoard
        title="No stalls yet"
        body="Snap a price list, a bill for a customer or a monthly notice. Your stall, invoices and plans will all live here."
        action="Start with a photo"
        href="/new"
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
      <header className="flex items-end justify-between gap-3">
        <h1 className="font-serif text-4xl text-ink">My stalls</h1>
        <Button variant="action" asChild>
          <Link href="/new">
            <Plus /> New from paper
          </Link>
        </Button>
      </header>
      {stalls.length ? (
        <Section title="Stalls">
          {stalls.map((s) => (
            <Link key={s.id} href={`/studio/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
              <span className="font-medium">{s.payload.n}</span>
              <span className="text-sm text-muted-foreground">
                {s.payload.i.length} items · {s.payload.c}
              </span>
            </Link>
          ))}
        </Section>
      ) : null}
      {invoices.length ? (
        <Section title="Invoices">
          {invoices.map((i) => (
            <Link key={i.id} href={`/i/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
              <span className="font-medium">{i.customer}</span>
              <span className="text-sm text-muted-foreground">
                {formatMoney(i.totalMinor, i.currency)} · {i.status.toLowerCase().replaceAll("_", " ")}
              </span>
            </Link>
          ))}
        </Section>
      ) : null}
      {plans.length ? (
        <Section title="Subscription plans">
          {plans.map((p) => (
            <Link key={p.planId} href={`/sub/${p.planId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
              <span className="font-medium">{p.name}</span>
              <span className="text-sm text-muted-foreground">
                {formatMoney(p.priceMinor, p.currency)} / {p.interval} · {p.subscriptionIds.length} known subscriber(s)
              </span>
            </Link>
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      <div className="divide-y overflow-hidden rounded-xl border bg-card">{children}</div>
    </section>
  );
}
