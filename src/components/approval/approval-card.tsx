"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, ShieldCheck, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";

export type Proposal = {
  id: string;
  title: string; // "Refund $3.00 to Sam"
  what: string; // plain-language effect
  amount?: string;
  recipient?: string;
  endpoint: string; // "POST /v2/payments/captures/{id}/refund"
  fields?: { key: string; label: string; value: string; type?: "text" | "number"; inputMode?: "decimal"; validate?: (value: string) => string | null }[];
  /** Recomputes the header and the PayPal call from edited fields, so the card shows what Approve sends. */
  preview?: (fields: Record<string, string>) => Partial<Pick<Proposal, "title" | "amount" | "endpoint">>;
};

type Props = {
  proposal: Proposal;
  onApprove: (fields: Record<string, string>) => Promise<string>; // resolves to a result line
  onReject: () => void;
  state?: "pending" | "done" | "rejected";
};

/** Nothing that moves money or contacts a customer runs until the seller presses Approve. */
export function ApprovalCard({ proposal, onApprove, onReject, state: initial = "pending" }: Props) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<"pending" | "editing" | "running" | "done" | "rejected" | "failed">(initial);
  const [fields, setFields] = useState<Record<string, string>>(Object.fromEntries((proposal.fields ?? []).map((f) => [f.key, f.value])));
  const [result, setResult] = useState<string | null>(null);
  const shown = { ...proposal, ...proposal.preview?.(fields) };
  const errors = Object.fromEntries((proposal.fields ?? []).map((f) => [f.key, f.validate?.(fields[f.key] ?? "") ?? null]));
  const invalid = Object.values(errors).some(Boolean);

  async function approve() {
    if (invalid || state === "running" || state === "done") return;
    setState("running");
    try {
      setResult(await onApprove(fields));
      setState("done");
    } catch (e) {
      setResult(e instanceof Error ? e.message : "PayPal didn't accept this.");
      setState("failed");
    }
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="overflow-hidden rounded-2xl border-2 border-ink/80 bg-card shadow-md"
      role="group"
      aria-label={`Approval needed: ${shown.title}`}
    >
      <div className="flex items-center gap-2 bg-ink px-4 py-2 text-paper">
        <ShieldCheck className="size-4" />
        <span className="text-xs font-semibold tracking-widest uppercase">Needs your approval</span>
      </div>
      <div className="space-y-3 p-4">
        <p className="font-serif text-2xl leading-tight text-ink">{shown.title}</p>
        <p className="text-sm">{proposal.what}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {shown.amount ? (
            <>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-medium tabular-nums">{shown.amount}</dd>
            </>
          ) : null}
          {proposal.recipient ? (
            <>
              <dt className="text-muted-foreground">To</dt>
              <dd>{proposal.recipient}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">PayPal</dt>
          <dd className="font-mono text-xs break-all">{shown.endpoint}</dd>
        </dl>
        {state === "editing" ? (
          <div className="space-y-2">
            {(proposal.fields ?? []).map((f) => (
              <label key={f.key} className="block space-y-0.5 text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <input
                  type={f.inputMode ? "text" : (f.type ?? "text")}
                  inputMode={f.inputMode}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((x) => ({ ...x, [f.key]: e.target.value }))}
                  aria-invalid={errors[f.key] ? true : undefined}
                  aria-describedby={errors[f.key] ? `${proposal.id}-${f.key}-err` : undefined}
                  className="w-full rounded-md border bg-background px-2 py-1 aria-invalid:border-danger"
                />
                {errors[f.key] ? (
                  <span id={`${proposal.id}-${f.key}-err`} className="block text-xs text-danger-ink">
                    {errors[f.key]}
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        ) : null}
        {state === "done" ? (
          <p className="flex items-center gap-1.5 text-sm text-success-ink" role="status">
            <Check className="size-4" /> {result}
          </p>
        ) : state === "rejected" ? (
          <p className="text-sm text-muted-foreground">Rejected. Nothing was sent to PayPal.</p>
        ) : state === "failed" ? (
          <p role="alert" className="text-sm text-danger-ink">
            {result}
          </p>
        ) : null}
        {state === "pending" || state === "editing" || state === "running" || state === "failed" ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="action" onClick={approve} disabled={state === "running" || invalid}>
              {state === "running" ? <Loader2 className="animate-spin" /> : <Check />} Approve
            </Button>
            {proposal.fields?.length ? (
              <Button variant="outline" onClick={() => setState(state === "editing" ? "pending" : "editing")} disabled={state === "running"}>
                <Pencil /> Edit
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                setState("rejected");
                onReject();
              }}
              disabled={state === "running"}
            >
              <X /> Reject
            </Button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
