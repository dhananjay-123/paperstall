"use client";

import { useSyncExternalStore } from "react";
import { PaidReceipt } from "@/components/paid/paid-receipt";
import { Qr } from "@/components/share/qr";
import { findBuyerReceipt } from "@/lib/buyer-receipts";

const noop = () => () => {};

export function ReceiptView({ orderId }: { orderId: string }) {
  const r = useSyncExternalStore(noop, () => findBuyerReceipt(orderId) ?? null, () => null);
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
      <PaidReceipt title={r.stallName} totalMinor={r.totalMinor} currency={r.currency} items={r.items} at={r.at} orderId={r.orderId} />
      <section className="space-y-3 rounded-2xl border bg-card p-5 text-center">
        <h1 className="font-serif text-3xl text-ink">Show this to the seller</h1>
        <p className="text-sm text-muted-foreground">They scan it to confirm your payment with PayPal.</p>
        <div className="flex justify-center">
          <Qr value={r.receiptCode} size={240} label={`Payment proof for order ${r.orderId}`} className="rounded-lg" />
        </div>
        <p className="font-mono text-xs text-muted-foreground">PayPal order {r.orderId}</p>
      </section>
    </div>
  );
}
