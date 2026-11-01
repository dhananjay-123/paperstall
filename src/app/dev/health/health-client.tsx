"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ReceiptList } from "@/components/receipts/receipt-list";
import { api, ApiCallError } from "@/lib/api-client";
import { useStore } from "@/lib/store";

type Line = { at: string; text: string; tone: "ok" | "bad" | "info" };

export function HealthClient() {
  const params = useSearchParams();
  const receipts = useStore((s) => s.receipts);
  const [log, setLog] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const push = (text: string, tone: Line["tone"] = "info") => setLog((l) => [{ at: new Date().toLocaleTimeString(), text, tone }, ...l]);

  async function run<T>(label: string, fn: () => Promise<T>, done: (r: T) => string) {
    setBusy(true);
    try {
      push(done(await fn()), "ok");
    } catch (e) {
      const err = e instanceof ApiCallError ? `${e.error.code}: ${e.error.message}${e.error.debugId ? ` (debug_id ${e.error.debugId})` : ""}` : String(e);
      push(`${label} failed — ${err}`, "bad");
    } finally {
      setBusy(false);
    }
  }

  // PayPal sends the buyer back with ?token=<orderId> after approval.
  const returned = params.get("return") === "1" ? params.get("token") : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="action"
          disabled={busy}
          onClick={() =>
            run(
              "Create order",
              () => api<{ orderId: string; status: string; approveUrl?: string }>("/api/v1/dev/health?step=order", { method: "POST" }),
              (r) => {
                if (r.approveUrl) window.open(r.approveUrl, "_self");
                return `Created $1.00 order ${r.orderId} (${r.status}). Opening PayPal to approve…`;
              },
            )
          }
        >
          1 · Create + approve $1 order
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(
              "Invoice",
              () => api<{ invoiceId: string }>("/api/v1/dev/health?step=invoice", { method: "POST" }),
              (r) => `Created and deleted draft invoice ${r.invoiceId}`,
            )
          }
        >
          2 · Create + delete draft invoice
        </Button>
      </div>
      {returned ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-action/40 bg-accent p-3 text-sm">
          <span>PayPal sent you back with order {returned}.</span>
          <Button
            size="sm"
            variant="action"
            disabled={busy}
            onClick={() =>
              run(
                "Capture",
                () =>
                  api<{ orderId: string; status: string; captureId?: string; captureStatus?: string }>(
                    `/api/v1/dev/health?step=capture&orderId=${encodeURIComponent(returned)}`,
                    { method: "POST" },
                  ),
                (r) => `Captured order ${r.orderId}: ${r.status}, capture ${r.captureId} ${r.captureStatus}`,
              )
            }
          >
            Capture it
          </Button>
        </div>
      ) : null}
      {params.get("cancel") === "1" ? <p className="text-sm text-warning-ink">You cancelled the PayPal approval.</p> : null}
      <ol aria-live="polite" className="space-y-1 font-mono text-xs">
        {log.map((l, i) => (
          <li key={i} className={l.tone === "ok" ? "text-success-ink" : l.tone === "bad" ? "text-danger-ink" : "text-muted-foreground"}>
            {l.at} · {l.text}
          </li>
        ))}
      </ol>
      <section className="space-y-2">
        <h2 className="font-serif text-2xl text-ink">Receipts</h2>
        <ReceiptList receipts={receipts.slice(0, 20)} />
      </section>
    </div>
  );
}
