"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { PaidReceipt } from "@/components/paid/paid-receipt";
import { Qr } from "@/components/share/qr";
import { formatPickup } from "@/core/doorbell";
import { api } from "@/lib/api-client";
import { findBuyerReceipt } from "@/lib/buyer-receipts";

const noop = () => () => {};

export function ReceiptView({ orderId }: { orderId: string }) {
  const r = useSyncExternalStore(noop, () => findBuyerReceipt(orderId) ?? null, () => null);
  const [refundedMinor, setRefunded] = useState(0);
  const known = Boolean(r);
  // The saved receipt is what was paid; PayPal says whether any of it has been refunded since.
  useEffect(() => {
    if (!known) return;
    let alive = true;
    api<{ refundedMinor?: number }>(`/api/v1/orders/${encodeURIComponent(orderId)}`)
      .then((o) => alive && setRefunded(o.refundedMinor ?? 0))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [known, orderId]);
  if (!r) {
    return (
      <div className="mx-auto max-w-md space-y-2 px-4 py-20 text-center">
        <h1 className="font-serif text-3xl text-ink">Receipt not on this device</h1>
        <p className="text-muted-foreground">
          Receipts are kept on the phone that paid. The seller can still confirm order <span className="font-mono">{orderId}</span> by typing it in.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-md space-y-8 px-4 py-10">
      <PaidReceipt title={r.stallName} totalMinor={r.totalMinor} currency={r.currency} items={r.items} at={r.at} orderId={r.orderId} refundedMinor={refundedMinor} />
      {r.pickupCode ? (
        <section className="rounded-2xl border-2 border-ink bg-card p-5 text-center">
          <h1 className="text-sm text-muted-foreground">Your pickup code</h1>
          <p className="mt-1 font-mono text-5xl font-bold tracking-[0.15em] text-ink">{formatPickup(r.pickupCode)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Say this code when you collect your order. It matches the one on the seller’s screen.</p>
        </section>
      ) : null}
      <section className="space-y-3 rounded-2xl border bg-card p-5 text-center">
        <h2 className="font-serif text-3xl text-ink">{r.pickupCode ? "No order on their screen?" : "Show this to the seller"}</h2>
        <p className="text-sm text-muted-foreground">They can scan this to confirm your payment with PayPal.</p>
        <div className="flex justify-center">
          <Qr value={r.receiptCode} size={240} label={`Payment proof for order ${r.orderId}`} className="rounded-lg" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">No camera at the counter? Read out this order ID:</p>
          <p className="mt-1 font-mono text-xl font-semibold tracking-wider text-ink">{r.orderId.match(/.{1,4}/g)?.join(" ")}</p>
        </div>
      </section>
    </div>
  );
}
