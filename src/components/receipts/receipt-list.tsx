"use client";

import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import type { Receipt } from "@/core/receipts";

function CopyId({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded px-1 font-mono hover:bg-muted"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      aria-label={`Copy ${value}`}
    >
      {value}
      {done ? <Check className="size-3" /> : <Copy className="size-3 opacity-50" />}
    </button>
  );
}

export function ReceiptList({ receipts }: { receipts: Receipt[] }) {
  if (!receipts.length) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No calls yet. Every PayPal, Gemini and Channel3 call shows up here with its IDs.</p>;
  }
  return (
    <ul className="divide-y rounded-lg border bg-card text-xs">
      {receipts.map((r) => (
        <li key={r.id} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 p-2.5">
          <span className={`mt-0.5 ${r.ok ? "text-success-ink" : "text-danger-ink"}`}>{r.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}</span>
          <div className="min-w-0 space-y-0.5">
            <p className="truncate">
              <span className="font-medium uppercase">{r.service}</span> <span className="font-mono">{r.method} {r.path}</span>{" "}
              <span className="text-muted-foreground">
                · {r.status} · {r.ms}ms{r.via ? ` · via ${r.via}` : ""}
              </span>
            </p>
            <p className="flex flex-wrap gap-x-3 text-muted-foreground">
              <span>{new Date(r.at).toLocaleString()}</span>
              {r.note ? <span>{r.note}</span> : null}
              {r.debugId ? (
                <span>
                  debug_id <CopyId value={r.debugId} />
                </span>
              ) : null}
              {r.requestId ? <span className="truncate">request-id {r.requestId.slice(0, 8)}…</span> : null}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
