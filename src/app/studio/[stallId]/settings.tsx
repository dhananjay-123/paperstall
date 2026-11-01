"use client";

import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAYPAL_CURRENCIES } from "@/core/money";
import { useStore } from "@/lib/store";

export function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  function exportData() {
    const s = useStore.getState();
    const data = { version: s.version, stalls: s.stalls, ledger: s.ledger, invoices: s.invoices, plans: s.plans, receipts: s.receipts, settings: s.settings, art: s.art, artOrder: s.artOrder };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `paperstall-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importData(f: File) {
    try {
      useStore.getState().importData(JSON.parse(await f.text()));
      setMsg("Imported. Your stalls and ledger are restored on this device.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "That file couldn't be imported.");
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-serif text-2xl text-ink">Payments</h2>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">PayPal email for new stalls</span>
          <input type="email" value={settings.payeeEmail} onChange={(e) => setSettings({ payeeEmail: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2" />
          <span className="text-xs text-muted-foreground">Published stalls keep the email they were signed with. Republish to change it.</span>
        </label>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-1">
            <span className="font-medium">Display currency</span>
            <select value={settings.displayCurrency} onChange={(e) => setSettings({ displayCurrency: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2">
              {Object.keys(PAYPAL_CURRENCIES).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="font-medium">Your rate</span>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              value={settings.fxRate}
              onChange={(e) => setSettings({ fxRate: Math.max(0.0001, Number(e.target.value) || 1), fxRateDate: new Date().toISOString().slice(0, 10) })}
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">A rate you set (last changed {settings.fxRateDate}). It&apos;s not live FX; it&apos;s only used to show approximate amounts.</p>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-serif text-2xl text-ink">This device</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.sound} onChange={(e) => setSettings({ sound: e.target.checked })} className="size-4 accent-[var(--action)]" />
          Play a “ka-ching” when a payment is confirmed
        </label>
        <p className="text-sm text-muted-foreground">Everything here lives in this browser only. Export a backup to move it to another device.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportData}>
            <Download /> Export data
          </Button>
          <Button size="sm" variant="outline" onClick={() => file.current?.click()}>
            <Upload /> Import data
          </Button>
          <input ref={file} type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} aria-label="Import a Paperstall backup" />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (window.confirm("Remove all stalls, sales and settings from this device? PayPal records are not affected.")) {
                useStore.getState().reset();
                setMsg("Cleared.");
              }
            }}
          >
            <Trash2 /> Reset this device
          </Button>
        </div>
        {msg ? <p className="text-sm" role="status">{msg}</p> : null}
      </section>
    </div>
  );
}
