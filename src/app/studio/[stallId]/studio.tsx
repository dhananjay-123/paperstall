"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bot, LayoutDashboard, ReceiptText, ScanLine, Settings2, Table2 } from "lucide-react";
import { ReceiptList } from "@/components/receipts/receipt-list";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Overview } from "./overview";
import { SettingsPanel } from "./settings";

// Heavier panels load only when opened.
const Ledger = dynamic(() => import("./ledger").then((m) => m.Ledger), { ssr: false, loading: () => <div className="h-64 rounded-xl ink-shimmer" /> });
const Penny = dynamic(() => import("./penny").then((m) => m.Penny), { ssr: false, loading: () => <div className="h-64 rounded-xl ink-shimmer" /> });

type Tab = "overview" | "ledger" | "penny" | "settings";

export function Studio({ stallId }: { stallId: string }) {
  const stall = useStore((s) => s.stalls.find((x) => x.id === stallId));
  const receipts = useStore((s) => s.receipts);
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("overview");
  const [showReceipts, setShowReceipts] = useState(false);

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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard /> },
    { id: "ledger", label: "Ledger", icon: <Table2 /> },
    { id: "penny", label: "Penny", icon: <Bot /> },
    { id: "settings", label: "Settings", icon: <Settings2 /> },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-hand text-xl text-action">{params.get("published") ? "published!" : "studio"}</p>
          <h1 className="font-serif text-4xl text-ink">{stall.payload.n}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowReceipts((v) => !v)} aria-expanded={showReceipts}>
            <ReceiptText /> Receipts ({receipts.length})
          </Button>
          <Button variant="action" size="lg" asChild>
            <Link href={`/verify?stall=${stall.id}`}>
              <ScanLine /> Scan to confirm payment
            </Link>
          </Button>
        </div>
      </header>

      {showReceipts ? (
        <section aria-label="Receipts" className="space-y-2">
          <p className="text-sm text-muted-foreground">Every PayPal, Gemini and Channel3 call this device made, with PayPal debug IDs. Nothing is faked.</p>
          <ReceiptList receipts={receipts.slice(0, 60)} />
        </section>
      ) : null}

      <div role="tablist" aria-label="Studio sections" className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "overview" ? <Overview stall={stall} /> : null}
        {tab === "ledger" ? <Ledger stallId={stall.id} /> : null}
        {tab === "penny" ? <Penny stall={stall} /> : null}
        {tab === "settings" ? <SettingsPanel /> : null}
      </div>
    </div>
  );
}
