"use client";

import { useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { ApprovalCard, type Proposal } from "@/components/approval/approval-card";
import { Button } from "@/components/ui/button";
import type { AgentProposal } from "@/core/agent";
import { formatMoney, isPayPalCurrency, toMinor, type CurrencyCode } from "@/core/money";
import { peekStall } from "@/core/peek";
import type { Stall } from "@/core/stall";
import { api, ApiCallError } from "@/lib/api-client";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "model"; text: string; proposals?: AgentProposal[] };

const EXAMPLES = [
  "Who hasn't paid me this week? Remind them politely.",
  "Refund half of order 3, the croissants were stale.",
  "Mark order 2 shipped, tracking 1Z999AA10123456784, UPS.",
  "Bill Northwind Studio for 200 business cards, $0.20 each, due Friday.",
  "How did the stall do today?",
];

export function Penny({ stall, compact = false }: { stall: Stall; compact?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const currency = stall.payload.c as CurrencyCode;

  function numberedLedger() {
    const s = useStore.getState();
    return [...s.ledger]
      .filter((l) => l.kind === "order" && l.stallId === stall.id)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((l, i) => ({ n: i + 1, entry: l }));
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: t }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setError(null);
    const s = useStore.getState();
    try {
      const res = await api<{ reply: string; proposals: AgentProposal[] }>("/api/v1/ai/penny", {
        body: {
          messages: next.slice(-12).map((m) => ({ role: m.role, text: m.text.slice(0, 2000) })),
          context: {
            today: new Date().toString().slice(0, 33),
            stall: { id: stall.id, name: stall.payload.n, currency },
            invoices: s.invoices.slice(0, 200).map((i) => ({ id: i.id, number: i.number, customer: i.customer.slice(0, 120), status: i.status, totalMinor: i.totalMinor, currency: i.currency, dueDate: i.dueDate })),
            ledger: numberedLedger()
              .slice(-500)
              .map(({ n, entry: l }) => ({
                n,
                id: l.id,
                at: l.at,
                customer: l.customer,
                items: l.items.map((i) => `${i.quantity}× ${i.name}`).join(", ").slice(0, 300),
                totalMinor: l.totalMinor,
                refundedMinor: l.refundedMinor ?? 0,
                currency: l.currency,
              })),
          },
        },
      });
      setMsgs((m) => [...m, { role: "model", text: res.reply, proposals: res.proposals }]);
    } catch (e) {
      setError(e instanceof ApiCallError ? e.error.message : "Penny couldn't answer right now.");
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }
  }

  return (
    <div className={compact ? "" : "grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]"}>
      <section className={cn("flex flex-col rounded-2xl border bg-card", compact ? "max-h-[calc(100vh-7rem)] min-h-[24rem]" : "min-h-[28rem]")}>
        {compact ? (
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
              <Sparkles className="size-5 text-action dark:text-chalk" /> Penny
            </p>
            <span className="text-xs text-muted-foreground">Asks before moving money</span>
          </div>
        ) : null}
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {!msgs.length ? (
            <div className="space-y-3">
              <p className="font-serif text-2xl text-ink">Hi, I&apos;m Penny.</p>
              <p className="text-sm text-muted-foreground">I can check payments, chase invoices, refund and ship. Anything that moves money waits for your approval.</p>
              <div className="flex flex-wrap gap-2">
                {(compact ? EXAMPLES.slice(0, 3) : EXAMPLES).map((e) => (
                  <button key={e} onClick={() => void send(e)} className="rounded-full border bg-background px-3 py-1.5 text-left text-sm hover:border-action focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "space-y-3"}>
              <p className={m.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-sm text-paper" : "max-w-[90%] text-sm"}>{m.text}</p>
              {m.proposals?.map((p) => <ProposalCard key={p.id} p={p} stall={stall} ledger={numberedLedger()} />)}
            </div>
          ))}
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Penny is checking…
            </p>
          ) : null}
          {error ? <p className="text-sm text-danger-ink">{error}</p> : null}
          <div ref={end} />
        </div>
        <form
          className="flex gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label htmlFor="penny-input" className="sr-only">
            Ask Penny
          </label>
          <input id="penny-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder="Ask Penny…" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
          <Button type="submit" variant="action" disabled={busy || !input.trim()} aria-label="Send">
            <Send />
          </Button>
        </form>
      </section>
      {compact ? null : (
      <aside className="space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How Penny stays safe</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Read-only lookups (orders, invoices, sales, market prices) run straight away.</li>
          <li>Refunds, reminders, cancellations, new invoices and shipping only become cards. Nothing reaches PayPal until you press Approve.</li>
          <li>Refunds can&apos;t exceed what was captured; every call shows up in Receipts with its PayPal debug ID.</li>
          <li>At most 5 tool steps per question.</li>
        </ul>
      </aside>
      )}
    </div>
  );

  function ProposalCard({ p, stall: st, ledger }: { p: AgentProposal; stall: Stall; ledger: ReturnType<typeof numberedLedger> }) {
    const built = buildProposal(p, st, ledger);
    if (!built) return <p className="text-sm text-warning-ink">Penny suggested something I can&apos;t match to your records, so nothing was proposed.</p>;
    return <ApprovalCard proposal={built.card} onApprove={built.run} onReject={() => {}} />;
  }
}

function buildProposal(p: AgentProposal, stall: Stall, ledger: { n: number; entry: ReturnType<typeof useStore.getState>["ledger"][number] }[]): { card: Proposal; run: (f: Record<string, string>) => Promise<string> } | null {
  const s = useStore.getState();
  const a = p.args as Record<string, unknown>;
  const cur = stall.payload.c as CurrencyCode;

  if (p.tool === "send_invoice_reminder" || p.tool === "cancel_invoice") {
    const inv = s.invoices.find((i) => i.id === a.invoiceId);
    if (!inv) return null;
    const remind = p.tool === "send_invoice_reminder";
    return {
      card: {
        id: p.id,
        title: remind ? `Remind ${inv.customer}` : `Cancel invoice for ${inv.customer}`,
        what: remind ? "PayPal emails a payment reminder." : "PayPal cancels the invoice and tells the customer.",
        amount: formatMoney(inv.totalMinor, inv.currency),
        recipient: inv.email ?? inv.customer,
        endpoint: `POST /v2/invoicing/invoices/${inv.id}/${remind ? "remind" : "cancel"}`,
        fields: [{ key: "note", label: "Note to customer", value: String(a.note ?? (remind ? "Just a friendly reminder. Thank you!" : "")) }],
      },
      run: async (f) => {
        const res = await api<{ status: string }>(`/api/v1/invoices/${inv.id}`, { body: { action: remind ? "remind" : "cancel", owner: inv.owner, note: f.note || undefined } });
        s.upsertInvoice({ ...inv, status: res.status });
        return remind ? "Reminder sent." : `Invoice ${res.status.toLowerCase()}.`;
      },
    };
  }

  if (p.tool === "refund_capture" || p.tool === "add_tracking") {
    const ref = String(a.order ?? "").trim();
    const row = ledger.find((l) => l.entry.id === ref || String(l.n) === ref.replace(/^#/, ""));
    const l = row?.entry;
    if (!l?.captureId) return null;
    const lc = (isPayPalCurrency(l.currency) ? l.currency : cur) as CurrencyCode;
    if (p.tool === "refund_capture") {
      const remaining = l.totalMinor - (l.refundedMinor ?? 0);
      const n = row?.n ?? 0;
      const asked =
        typeof a.fraction === "number"
          ? Math.min(remaining, Math.round(l.totalMinor * a.fraction))
          : typeof a.amount === "number"
            ? Math.min(remaining, toMinor(a.amount, lc))
            : remaining;
      return {
        card: {
          id: p.id,
          title: `Refund ${formatMoney(asked, lc)} on order ${n}`,
          what: `${a.reason ? `Reason: ${String(a.reason)}. ` : ""}PayPal returns the money to the buyer.`,
          amount: formatMoney(asked, lc),
          recipient: l.customer ?? "the buyer",
          endpoint: `POST /v2/payments/captures/${l.captureId}/refund`,
          fields: [{ key: "amount", label: `Amount (${lc})`, value: String(asked / 10 ** (lc === "JPY" || lc === "HUF" || lc === "TWD" ? 0 : 2)), type: "number" }],
        },
        run: async (f) => {
          const minor = toMinor(Number(f.amount), lc);
          if (!(minor > 0) || minor > remaining) throw new Error("Enter an amount up to what's left to refund.");
          const res = await api<{ refundId: string; status: string; refundedMinor: number }>(`/api/v1/orders/${l.id}`, {
            body: { action: "refund", stallId: stall.id, owner: stall.owner, captureId: l.captureId, amountMinor: minor === l.totalMinor ? undefined : minor, note: a.reason ? String(a.reason).slice(0, 255) : undefined },
          });
          const total = (l.refundedMinor ?? 0) + res.refundedMinor;
          s.patchLedger(l.id, { refundedMinor: total, status: total >= l.totalMinor ? "REFUNDED" : "PARTIALLY_REFUNDED" });
          return `Refunded ${formatMoney(res.refundedMinor, lc)} (refund ${res.refundId}).`;
        },
      };
    }
    return {
      card: {
        id: p.id,
        title: `Mark order ${row?.n ?? ""} shipped`,
        what: `Adds ${String(a.carrier)} tracking ${String(a.trackingNumber)} and notifies the buyer.`,
        recipient: l.customer ?? "the buyer",
        endpoint: `POST /v2/checkout/orders/${l.id}/track`,
        fields: [
          { key: "number", label: "Tracking number", value: String(a.trackingNumber) },
          { key: "carrier", label: "Carrier", value: String(a.carrier).toUpperCase() },
        ],
      },
      run: async (f) => {
        await api(`/api/v1/orders/${l.id}`, { body: { action: "track", stallId: stall.id, owner: stall.owner, captureId: l.captureId, trackingNumber: f.number, carrier: f.carrier } });
        s.patchLedger(l.id, { tracking: { number: f.number, carrier: f.carrier } });
        return "Tracking added; the buyer is notified by PayPal.";
      },
    };
  }

  if (p.tool === "create_invoice_from_text") {
    const c = (typeof a.currency === "string" && isPayPalCurrency(a.currency.toUpperCase()) ? a.currency.toUpperCase() : cur) as CurrencyCode;
    const items = (a.items as { name: string; quantity: number; unitPrice: number }[]).map((i) => ({ name: i.name, quantity: i.quantity, unitMinor: toMinor(i.unitPrice, c) }));
    const total = items.reduce((n, i) => n + i.unitMinor * i.quantity, 0);
    return {
      card: {
        id: p.id,
        title: `Invoice ${String(a.customerName)} for ${formatMoney(total, c)}`,
        what: items.map((i) => `${i.quantity} × ${i.name} @ ${formatMoney(i.unitMinor, c)}`).join(", "),
        amount: formatMoney(total, c),
        recipient: String(a.customerEmail ?? "add an email"),
        endpoint: "POST /v2/invoicing/invoices → /send → /generate-qr-code",
        fields: [
          { key: "email", label: "Customer email", value: String(a.customerEmail ?? "") },
          { key: "due", label: "Due date (YYYY-MM-DD)", value: String(a.dueDate ?? "") },
        ],
      },
      run: async (f) => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email ?? "")) throw new Error("Add the customer's email (Edit).");
        const due = /^\d{4}-\d{2}-\d{2}$/.test(f.due ?? "") ? f.due : undefined;
        const [given, ...rest] = String(a.customerName).split(/\s+/);
        const res = await api<{ id: string; number?: string; status: string; totalMinor: number; payerUrl?: string; qrPng?: string; owner: string }>("/api/v1/invoices", {
          body: { currency: c, businessName: stall.payload.n, recipient: { email: f.email, givenName: given, surname: rest.join(" ") || undefined, businessName: String(a.customerName) }, items, dueDate: due },
        });
        s.upsertInvoice({ id: res.id, stallId: stall.id, number: res.number, customer: String(a.customerName), email: f.email, currency: c, totalMinor: res.totalMinor, status: res.status, payerUrl: res.payerUrl, qrPng: res.qrPng, owner: res.owner, createdAt: new Date().toISOString(), dueDate: due });
        return `Invoice ${res.number ?? res.id} sent.`;
      },
    };
  }

  if (p.tool === "create_payment_link_for_items") {
    const c = (typeof a.currency === "string" && isPayPalCurrency(a.currency.toUpperCase()) ? a.currency.toUpperCase() : cur) as CurrencyCode;
    const price = toMinor(Number(a.price), c);
    return {
      card: {
        id: p.id,
        title: `Payment link: ${String(a.name)} for ${formatMoney(price, c)}`,
        what: "Creates a one-item stall link paying your PayPal account. Nothing is charged until a buyer pays.",
        amount: formatMoney(price, c),
        recipient: stall.payload.p,
        endpoint: "Signed stall link → POST /v2/checkout/orders at checkout",
      },
      run: async () => {
        const payload = { n: String(a.name).slice(0, 60), c, p: stall.payload.p, i: [{ id: "item", name: String(a.name).slice(0, 80), price }], t: stall.payload.t };
        const { signed, doorbell, id, owner } = await api<{ signed: string; doorbell?: string; id: string; owner: string }>("/api/v1/stalls/sign", { body: { payload } });
        s.upsertStall({ id, payload: peekStall(signed)!, signed, createdAt: new Date().toISOString(), intent: "shop", doorbell, owner });
        const url = `${window.location.origin}/s#${signed}`;
        void navigator.clipboard?.writeText(url);
        return "Link created and copied. It's also in your stalls list.";
      },
    };
  }
  return null;
}
