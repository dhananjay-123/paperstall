"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Download } from "lucide-react";
import { ApprovalCard, type Proposal } from "@/components/approval/approval-card";
import { Button } from "@/components/ui/button";
import { convertMinor, exponent, formatMoney, isPayPalCurrency, toMinor } from "@/core/money";
import { api } from "@/lib/api-client";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  kind: "order" | "invoice" | "subscription";
  at: string;
  customer: string;
  items: string;
  currency: string;
  totalMinor: number;
  refundedMinor: number;
  status: string;
  captureId?: string;
};

const col = createColumnHelper<Row>();

const PILL: Record<string, string> = {
  COMPLETED: "bg-success/15 text-success-ink",
  PAID: "bg-success/15 text-success-ink",
  ACTIVE: "bg-success/15 text-success-ink",
  REFUNDED: "bg-muted text-muted-foreground",
  PARTIALLY_REFUNDED: "bg-warning/15 text-warning-ink",
  SENT: "bg-accent text-ink",
  UNPAID: "bg-warning/15 text-warning-ink",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function Ledger({ stallId }: { stallId: string }) {
  const ledger = useStore((s) => s.ledger);
  const invoices = useStore((s) => s.invoices);
  const plans = useStore((s) => s.plans);
  const settings = useStore((s) => s.settings);
  const patchLedger = useStore((s) => s.patchLedger);
  const upsertInvoice = useStore((s) => s.upsertInvoice);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "at", desc: true }]);
  const [action, setAction] = useState<{ row: Row; proposal: Proposal; run: (f: Record<string, string>) => Promise<string> } | null>(null);

  const rows = useMemo<Row[]>(
    () => [
      ...ledger
        .filter((l) => l.stallId === stallId || l.kind !== "order")
        .map((l) => ({
          id: l.id,
          kind: l.kind,
          at: l.at,
          customer: l.customer ?? "Walk-up buyer",
          items: l.items.map((i) => `${i.quantity}× ${i.name}`).join(", "),
          currency: l.currency,
          totalMinor: l.totalMinor,
          refundedMinor: l.refundedMinor ?? 0,
          status: l.status,
          captureId: l.captureId,
        })),
      ...invoices
        .filter((i) => !ledger.some((l) => l.id === i.id))
        .map((i) => ({ id: i.id, kind: "invoice" as const, at: i.createdAt, customer: i.customer, items: i.number ? `Invoice ${i.number}` : "Invoice", currency: i.currency, totalMinor: i.totalMinor, refundedMinor: 0, status: i.status })),
      ...plans.map((p) => ({ id: p.planId, kind: "subscription" as const, at: p.createdAt, customer: `${p.subscriptionIds.length} subscriber(s) known`, items: `${p.name} / ${p.interval}`, currency: p.currency, totalMinor: p.priceMinor, refundedMinor: 0, status: "ACTIVE" })),
    ],
    [ledger, invoices, plans, stallId],
  );

  const approx = (r: Row) => {
    if (r.currency === settings.displayCurrency || !isPayPalCurrency(r.currency) || !isPayPalCurrency(settings.displayCurrency)) return null;
    return `≈ ${formatMoney(convertMinor(r.totalMinor, r.currency, settings.displayCurrency, settings.fxRate), settings.displayCurrency)}`;
  };

  function openRefund(r: Row) {
    const remaining = r.totalMinor - r.refundedMinor;
    const cur = isPayPalCurrency(r.currency) ? r.currency : "USD";
    setAction({
      row: r,
      proposal: {
        id: `refund-${r.id}`,
        title: `Refund ${formatMoney(remaining, r.currency)}`,
        what: `PayPal returns the money to the buyer of order ${r.id}. Edit the amount for a partial refund.`,
        amount: formatMoney(remaining, r.currency),
        recipient: r.customer,
        endpoint: `POST /v2/payments/captures/${r.captureId}/refund`,
        fields: [{ key: "amount", label: `Amount (${r.currency})`, value: (remaining / 10 ** exponent(cur)).toFixed(exponent(cur)), type: "number" }],
      },
      run: async (f) => {
        const amountMinor = toMinor(Number(f.amount), cur);
        if (!(amountMinor > 0) || amountMinor > remaining) throw new Error("Enter an amount up to what's left to refund.");
        const res = await api<{ refundId: string; status: string; refundedMinor: number }>(`/api/v1/orders/${r.id}`, {
          body: { action: "refund", captureId: r.captureId, amountMinor: amountMinor === r.totalMinor ? undefined : amountMinor },
        });
        const total = r.refundedMinor + res.refundedMinor;
        patchLedger(r.id, { refundedMinor: total, status: total >= r.totalMinor ? "REFUNDED" : "PARTIALLY_REFUNDED" });
        return `Refund ${res.refundId} ${res.status.toLowerCase()}.`;
      },
    });
  }

  function openTrack(r: Row) {
    setAction({
      row: r,
      proposal: {
        id: `track-${r.id}`,
        title: "Mark as shipped",
        what: "Adds tracking to the PayPal order and notifies the buyer.",
        recipient: r.customer,
        endpoint: `POST /v2/checkout/orders/${r.id}/track`,
        fields: [
          { key: "number", label: "Tracking number", value: "" },
          { key: "carrier", label: "Carrier (e.g. UPS, USPS, FEDEX, or OTHER)", value: "UPS" },
        ],
      },
      run: async (f) => {
        if (!f.number?.trim()) throw new Error("Add a tracking number.");
        await api(`/api/v1/orders/${r.id}`, { body: { action: "track", captureId: r.captureId, trackingNumber: f.number.trim(), carrier: f.carrier.trim() || "OTHER" } });
        patchLedger(r.id, { tracking: { number: f.number.trim(), carrier: f.carrier.trim() } });
        return "Tracking added.";
      },
    });
  }

  function openRemind(r: Row) {
    setAction({
      row: r,
      proposal: {
        id: `remind-${r.id}`,
        title: `Remind ${r.customer}`,
        what: `PayPal emails a polite reminder for invoice ${r.items}.`,
        amount: formatMoney(r.totalMinor, r.currency),
        recipient: r.customer,
        endpoint: `POST /v2/invoicing/invoices/${r.id}/remind`,
        fields: [{ key: "note", label: "Note", value: "Just a friendly reminder. Thank you!" }],
      },
      run: async (f) => {
        const res = await api<{ status: string }>(`/api/v1/invoices/${r.id}`, { body: { action: "remind", note: f.note } });
        const inv = useStore.getState().invoices.find((i) => i.id === r.id);
        if (inv) upsertInvoice({ ...inv, status: res.status });
        return "Reminder sent.";
      },
    });
  }

  const columns = [
    col.accessor("at", { header: "Time", cell: (c) => new Date(c.getValue()).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }),
    col.accessor("kind", { header: "Type", cell: (c) => <span className="capitalize">{c.getValue()}</span> }),
    col.accessor("customer", { header: "Customer" }),
    col.accessor("items", { header: "Items", cell: (c) => <span className="line-clamp-2">{c.getValue()}</span> }),
    col.accessor("totalMinor", {
      header: "Amount",
      cell: (c) => (
        <span className="tabular-nums">
          {formatMoney(c.getValue(), c.row.original.currency)}
          {approx(c.row.original) ? <span className="block text-xs text-muted-foreground">{approx(c.row.original)}</span> : null}
        </span>
      ),
    }),
    col.accessor("status", { header: "Status", cell: (c) => <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PILL[c.getValue()] ?? "bg-muted")}>{c.getValue().toLowerCase().replaceAll("_", " ")}</span> }),
    col.accessor("id", { header: "PayPal ID", cell: (c) => <CopyId id={c.getValue()} /> }),
    col.display({
      id: "actions",
      header: "",
      cell: (c) => <Actions row={c.row.original} onRefund={openRefund} onTrack={openTrack} onRemind={openRemind} />,
    }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: query, columnFilters: status === "all" ? [] : [{ id: "status", value: status }] },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  function csv() {
    const head = ["time", "type", "customer", "items", "currency", "amount", "refunded", "status", "paypal_id"];
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const lines = table.getFilteredRowModel().rows.map(({ original: r }) =>
      [r.at, r.kind, r.customer, r.items, r.currency, (r.totalMinor / 100).toFixed(2), (r.refundedMinor / 100).toFixed(2), r.status, r.id].map((v) => esc(String(v))).join(","),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = `paperstall-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const statuses = [...new Set(rows.map((r) => r.status))];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, item, PayPal ID…" aria-label="Search the ledger" className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="rounded-lg border bg-card px-2 py-2 text-sm">
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase().replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={csv} disabled={!rows.length}>
          <Download /> CSV
        </Button>
      </div>

      {action ? (
        <div className="max-w-lg">
          <ApprovalCard key={action.proposal.id} proposal={action.proposal} onApprove={action.run} onReject={() => setTimeout(() => setAction(null), 800)} />
          <Button variant="link" size="sm" onClick={() => setAction(null)}>
            Close
          </Button>
        </div>
      ) : null}

      {!rows.length ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No sales yet. Verified payments, invoices and plans appear here.</p>
      ) : (
        <>
          <div className="hidden max-h-[60vh] overflow-auto rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id} className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {h.column.getCanSort() ? (
                          <button className="inline-flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <ArrowUpDown className="size-3" />
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    {r.getVisibleCells().map((c) => (
                      <td key={c.id} className="px-3 py-2">
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {table.getRowModel().rows.map(({ original: r }) => (
              <li key={r.id} className="rounded-xl border bg-card p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">{formatMoney(r.totalMinor, r.currency)}</p>
                    <p className="truncate text-muted-foreground">{r.items}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PILL[r.status] ?? "bg-muted")}>{r.status.toLowerCase().replaceAll("_", " ")}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {new Date(r.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · <CopyId id={r.id} />
                  </span>
                  <Actions row={r} onRefund={openRefund} onTrack={openTrack} onRemind={openRemind} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Actions({ row, onRefund, onTrack, onRemind }: { row: Row; onRefund: (r: Row) => void; onTrack: (r: Row) => void; onRemind: (r: Row) => void }) {
  if (row.kind === "order" && row.captureId && row.refundedMinor < row.totalMinor) {
    return (
      <span className="flex gap-1">
        <Button size="xs" variant="outline" onClick={() => onRefund(row)}>
          Refund
        </Button>
        <Button size="xs" variant="ghost" onClick={() => onTrack(row)}>
          Track
        </Button>
      </span>
    );
  }
  if (row.kind === "invoice" && ["SENT", "UNPAID", "PARTIALLY_PAID"].includes(row.status)) {
    return (
      <Button size="xs" variant="outline" onClick={() => onRemind(row)}>
        Remind
      </Button>
    );
  }
  return null;
}

function CopyId({ id }: { id: string }) {
  return (
    <button type="button" className="font-mono text-xs hover:text-action" onClick={() => void navigator.clipboard?.writeText(id)} title="Copy PayPal ID">
      {id}
    </button>
  );
}
