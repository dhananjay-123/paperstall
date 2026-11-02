"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BarChart3, ReceiptText, ScanLine, Sparkles, Store, Table2 } from "lucide-react";
import { ReceiptList } from "@/components/receipts/receipt-list";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useLiveCounter } from "@/lib/use-live-counter";
import { cn } from "@/lib/utils";
import { LedgerPreview, LiveOrders, MyStallCard } from "./live";
import { Overview } from "./overview";
import { SettingsPanel } from "./settings";

// Heavier panels load only when opened.
const Ledger = dynamic(() => import("./ledger").then((m) => m.Ledger), { ssr: false, loading: () => <div className="h-64 rounded-xl ink-shimmer" /> });
const Penny = dynamic(() => import("./penny").then((m) => m.Penny), { ssr: false, loading: () => <div className="h-64 rounded-xl ink-shimmer" /> });

type Tab = "counter" | "ledger" | "stall" | "penny";

const TABS: { id: Tab; label: string; short: string; icon: React.ReactNode }[] = [
  { id: "counter", label: "Live counter", short: "Counter", icon: <BarChart3 /> },
  { id: "ledger", label: "Ledger", short: "Ledger", icon: <Table2 /> },
  { id: "stall", label: "My stall", short: "Stall", icon: <Store /> },
  { id: "penny", label: "Penny", short: "Penny", icon: <Sparkles /> },
];

export function Studio({ stallId }: { stallId: string }) {
  const stall = useStore((s) => s.stalls.find((x) => x.id === stallId));
  const receipts = useStore((s) => s.receipts);
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("counter");
  const [showReceipts, setShowReceipts] = useState(false);
  // Runs on every tab, so orders keep arriving while the seller looks at the ledger.
  const counter = useLiveCounter(stall?.intent === "shop" ? stall : undefined);

  if (!stall) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-ink">Stall not on this device</h1>
        <p className="text-muted-foreground">Your stalls live in this browser. Open the studio on the device you published from, or import a backup in Settings.</p>
        <Button variant="action" asChild>
          <Link href="/studio">All my stalls</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 lg:pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {params.get("published") ? <p className="font-hand text-xl text-action dark:text-chalk">published! your stall is live</p> : null}
          <h1 className="truncate text-3xl font-extrabold tracking-[-0.035em] text-ink">{stall.payload.n}</h1>
        </div>
        <nav aria-label="Studio" className="hidden items-center gap-1 rounded-full border bg-card p-1 lg:flex">
          {TABS.map((t) => (
            <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowReceipts((v) => !v)} aria-expanded={showReceipts}>
            <ReceiptText /> <span className="hidden sm:inline">Receipts</span> ({receipts.length})
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link href={`/verify?stall=${stall.id}`}>
              <ScanLine /> <span className="hidden sm:inline">Scan a receipt</span>
            </Link>
          </Button>
        </div>
      </header>

      {showReceipts ? (
        <section aria-label="Receipts" className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">Every PayPal, Gemini and Channel3 call this device made, with PayPal debug IDs. Nothing is faked.</p>
          <ReceiptList receipts={receipts.slice(0, 60)} />
        </section>
      ) : null}

      <div className="mt-6">
        {tab === "counter" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-6">
              <LiveOrders stall={stall} issues={counter.issues} fresh={counter.fresh} retry={counter.retry} />
              <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <LedgerPreview stallId={stall.id} onOpen={() => setTab("ledger")} />
                <MyStallCard stall={stall} />
              </div>
            </div>
            <aside aria-label="Penny" className="hidden lg:block">
              <div className="sticky top-20">
                <Penny stall={stall} compact />
              </div>
            </aside>
          </div>
        ) : null}
        {tab === "ledger" ? <Ledger stallId={stall.id} /> : null}
        {tab === "stall" ? (
          <div className="space-y-8">
            <Overview stall={stall} />
            <SettingsPanel />
          </div>
        ) : null}
        {tab === "penny" ? <Penny stall={stall} /> : null}
      </div>

      {/* Phone: a thumb-reach tab bar */}
      <nav aria-label="Studio" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium outline-none focus-visible:bg-muted [&_svg]:size-5",
                tab === t.id ? "text-ink dark:text-chalk" : "text-muted-foreground",
              )}
            >
              {t.icon}
              {t.short}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function TabButton({ t, active, onClick }: { t: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
        active ? "bg-muted text-ink" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {t.icon}
      {t.label}
    </button>
  );
}
