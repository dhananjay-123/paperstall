"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { InkCircle, type Box } from "@/components/ink/ink-circle";
import { Stamp } from "@/components/ink/stamp";
import { Button } from "@/components/ui/button";
import { formatMoney, toMinor } from "@/core/money";
import { mathCheck, taxMinorOf } from "@/core/read/checks";
import { api, ApiCallError } from "@/lib/api-client";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { effectiveCurrency } from "../read/read-client";

function plusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseDue(s?: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) || d.getTime() < Date.now() - 86_400_000 ? undefined : d.toISOString().slice(0, 10);
}

export function InvoicePublish() {
  const router = useRouter();
  const draft = useStore((s) => s.draft)!;
  const read = draft.read!;
  const currency = effectiveCurrency(draft)!;
  const { upsertInvoice, setDraft } = useStore.getState();
  const [hover, setHover] = useState<string | null>(null);
  const [business, setBusiness] = useState(read.business.name ?? "");
  const [customer, setCustomer] = useState(read.customer?.name ?? read.customer?.company ?? "");
  const [email, setEmail] = useState(read.customer?.email ?? "");
  const [due, setDue] = useState(parseDue(read.dates?.due) ?? plusDays(7));
  const [memo, setMemo] = useState(read.taxOrNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The paper's tax goes on the invoice as its own line, so PayPal's total matches the paper exactly.
  const lines = useMemo(() => {
    const items = read.items.filter((i) => i.unitPrice > 0).map((i) => ({ id: i.id, box: i.box, name: i.nameEn, quantity: Math.max(1, Math.round(i.quantity ?? 1)), unitMinor: toMinor(i.unitPrice, currency) }));
    const tax = taxMinorOf(read, currency);
    return tax > 0 ? [...items, { id: "tax", box: [0, 0, 0, 0], name: "Tax", quantity: 1, unitMinor: tax }] : items;
  }, [read, currency]);
  const total = lines.reduce((n, l) => n + l.unitMinor * l.quantity, 0);
  const math = mathCheck(read, currency);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const [given, ...rest] = customer.trim().split(/\s+/);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id: string; number?: string; status: string; totalMinor: number; payerUrl?: string; qrPng?: string; owner: string }>("/api/v1/invoices", {
        body: {
          currency,
          businessName: business || undefined,
          recipient: { email: email.trim(), givenName: given || undefined, surname: rest.join(" ") || undefined, businessName: read.customer?.company || undefined },
          items: lines.map(({ name, quantity, unitMinor }) => ({ name, quantity, unitMinor })),
          dueDate: due,
          memo: memo || undefined,
          note: read.sourceLanguage !== "en" ? `Original (${read.sourceLanguage}): ${read.items.map((i) => i.nameOriginal).join(", ")}`.slice(0, 1000) : undefined,
        },
      });
      upsertInvoice({
        id: res.id,
        stallId: draft.id,
        number: res.number,
        customer: customer || email,
        email: email.trim(),
        currency,
        totalMinor: res.totalMinor,
        status: res.status,
        payerUrl: res.payerUrl,
        qrPng: res.qrPng,
        owner: res.owner,
        createdAt: new Date().toISOString(),
        dueDate: due,
      });
      setDraft(null);
      router.push(`/i/${res.id}?sent=1`);
    } catch (e) {
      setError(e instanceof ApiCallError ? `${e.error.message}${e.error.debugId ? ` (debug_id ${e.error.debugId})` : ""}` : "Couldn't send the invoice.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-hand text-xl text-action">step 3 of 3</p>
        <h1 className="font-serif text-4xl text-ink">Check the invoice</h1>
        <p className="text-muted-foreground">Your paper on the left, the PayPal invoice on the right. Hover a line to see where it came from.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- the seller's own photo */}
          <img src={draft.imageDataUrl} alt="Your handwritten bill" className="block h-auto w-full" />
          {lines.map((l, i) =>
            hover === l.id && l.id !== "tax" ? <InkCircle key={`${l.id}-${hover}`} box={l.box as unknown as Box} seed={i + 5} color="var(--action)" /> : null,
          )}
        </div>
        <div className="space-y-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Your business name" className="min-w-0 flex-1 rounded-md bg-transparent px-1 font-serif text-xl text-ink outline-none hover:bg-muted focus:bg-muted" />
            <Stamp kind="invoice" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Bill to</span>
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1" placeholder="Customer name" />
            </label>
            <label className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Customer email {emailOk ? "" : "(needed)"}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!emailOk} className="w-full rounded-md border bg-background px-2 py-1" placeholder="client@example.com" />
            </label>
            <label className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Due date</span>
              <input type="date" value={due} min={plusDays(0)} onChange={(e) => setDue(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1" />
            </label>
            <label className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Memo (English)</span>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} className="w-full rounded-md border bg-background px-2 py-1" placeholder="Thanks for your business" />
            </label>
          </div>
          <table className="w-full">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-normal">Item</th>
                <th className="py-1 text-right font-normal">Qty</th>
                <th className="py-1 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr
                  key={l.id}
                  onMouseEnter={() => setHover(l.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(l.id)}
                  tabIndex={0}
                  className={cn("border-t outline-none", hover === l.id && "bg-accent")}
                >
                  <td className="py-1.5">{l.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(l.unitMinor * l.quantity, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="py-2" colSpan={2}>
                  Total
                </td>
                <td className="py-2 text-right tabular-nums">{formatMoney(total, currency)}</td>
              </tr>
            </tfoot>
          </table>
          {math && !math.ok ? (
            <p className="rounded-md bg-warning/10 p-2 text-warning-ink">
              Heads up: the paper says {formatMoney(math.written, currency)}. This invoice uses the correct sum, {formatMoney(math.computed, currency)}.
            </p>
          ) : null}
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4 text-sm">
        <p className="font-medium">What happens when you press Send</p>
        <p className="text-muted-foreground">
          PayPal creates this invoice ({formatMoney(total, currency)}), emails it to {email || "your customer"}, and gives you a QR code they can scan to pay.
          <span className="ml-1 font-mono text-xs">POST /v2/invoicing/invoices → /send → /generate-qr-code</span>
        </p>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
      <Button variant="action" size="lg" disabled={busy || !emailOk || !lines.length} onClick={send}>
        {busy ? <Loader2 className="animate-spin" /> : <Send />} Approve &amp; send invoice
      </Button>
    </div>
  );
}
