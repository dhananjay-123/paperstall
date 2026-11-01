"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { PaidReceipt } from "@/components/paid/paid-receipt";
import { Stamp } from "@/components/ink/stamp";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/core/money";
import { api, ApiCallError } from "@/lib/api-client";
import { kaching } from "@/lib/sound";
import { useStore } from "@/lib/store";

type Status = {
  id: string;
  number?: string;
  status: string;
  currency: string;
  totalMinor?: number;
  paidMinor?: number;
  dueDate?: string;
  payerUrl?: string;
  items: { name: string; quantity: number; unitMinor: number }[];
  qrPng?: string;
};

const PAID = ["PAID", "MARKED_AS_PAID"];

export function InvoiceView({ id }: { id: string }) {
  const local = useStore((s) => s.invoices.find((i) => i.id === id));
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const delay = useRef(10_000);

  const refresh = useCallback(
    async (withQr = false) => {
      setChecking(true);
      try {
        const s = await api<Status>(`/api/v1/invoices/${id}${withQr ? "?qr=1" : ""}`);
        setData((d) => ({ ...s, qrPng: s.qrPng ?? d?.qrPng }));
        setError(null);
        delay.current = 10_000;
        // A paid invoice reaches the seller's ledger only once PayPal says it's paid.
        const st = useStore.getState();
        const mine = st.invoices.find((i) => i.id === id);
        if (mine && mine.status !== s.status) st.upsertInvoice({ ...mine, status: s.status, lastCheckedAt: new Date().toISOString() });
        if (mine && PAID.includes(s.status)) {
          const added = st.addLedger({
            id,
            kind: "invoice",
            stallId: mine.stallId,
            at: new Date().toISOString(),
            customer: mine.customer,
            items: s.items.map((i) => ({ name: i.name, quantity: i.quantity })),
            currency: s.currency,
            totalMinor: s.paidMinor ?? s.totalMinor ?? mine.totalMinor,
            status: s.status,
            verifiedVia: "invoice-status",
          });
          if (added && st.settings.sound) kaching();
        }
      } catch (e) {
        setError(e instanceof ApiCallError ? e.error.message : "Couldn't reach PayPal.");
        delay.current = Math.min(120_000, delay.current * 2); // back off while failing
      } finally {
        setChecking(false);
      }
    },
    [id],
  );

  // Poll on an interval with backoff, and immediately when the tab regains focus.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = async (first: boolean) => {
      if (!alive) return;
      await refresh(first);
      if (alive) t = setTimeout(() => void loop(false), delay.current);
    };
    void loop(true);
    const onFocus = () => void refresh(false);
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearTimeout(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const qr = data?.qrPng ?? local?.qrPng;
  const paid = data && PAID.includes(data.status);
  const total = data?.totalMinor ?? local?.totalMinor;
  const currency = data?.currency ?? local?.currency ?? "USD";

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-10">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-hand text-xl text-action">{local ? "your invoice" : "invoice"}</p>
          <h1 className="font-serif text-4xl text-ink">{total !== undefined ? formatMoney(total, currency) : "…"}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.number ? `No. ${data.number} · ` : ""}
            {data?.dueDate ? `Due ${data.dueDate}` : "Due on receipt"}
            {local ? ` · to ${local.customer}` : ""}
          </p>
        </div>
        <Stamp kind={paid ? "paid" : "invoice"} label={data && !paid ? data.status.replaceAll("_", " ") : undefined} />
      </header>

      {paid ? (
        <PaidReceipt title="Invoice paid" totalMinor={data.paidMinor ?? total ?? 0} currency={currency} items={data.items} orderId={id} />
      ) : (
        <section className="space-y-3 rounded-2xl border bg-card p-5 text-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- PayPal-generated QR, as base64 PNG
            <img src={`data:image/png;base64,${qr}`} alt="Scan to pay this invoice with PayPal" width={240} height={240} className="mx-auto rounded-lg bg-white" />
          ) : (
            <div className="mx-auto size-60 rounded-lg ink-shimmer" />
          )}
          <p className="text-sm text-muted-foreground">Scan with a phone camera, or open the PayPal page.</p>
          {data?.payerUrl ?? local?.payerUrl ? (
            <Button variant="action" asChild>
              <a href={data?.payerUrl ?? local?.payerUrl} target="_blank" rel="noopener noreferrer">
                Pay with PayPal <ExternalLink />
              </a>
            </Button>
          ) : null}
        </section>
      )}

      {data?.items.length ? (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {data.items.map((i) => (
            <li key={i.name} className="flex justify-between gap-3 px-4 py-2">
              <span>
                {i.quantity} × {i.name}
              </span>
              <span className="tabular-nums">{formatMoney(i.unitMinor * i.quantity, currency)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span>{error ? <span className="text-warning-ink">{error} Retrying…</span> : data ? `Status from PayPal: ${data.status.toLowerCase().replaceAll("_", " ")}` : "Checking with PayPal…"}</span>
        <Button size="xs" variant="ghost" onClick={() => void refresh(false)} disabled={checking}>
          <RefreshCw className={checking ? "animate-spin" : ""} /> Check now
        </Button>
      </div>
    </div>
  );
}
