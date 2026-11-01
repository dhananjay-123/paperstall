"use client";

import { useSyncExternalStore } from "react";
import { Printer } from "lucide-react";
import { Qr } from "@/components/share/qr";
import { stallUrl } from "@/components/share/share-card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

const noop = () => () => {};

/** A printable A5 "Scan to pay" poster made from the seller's own paper. */
export function Poster({ stallId }: { stallId: string }) {
  const stall = useStore((s) => s.stalls.find((x) => x.id === stallId));
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  if (!stall) return <p className="p-10 text-center text-muted-foreground">Stall not found on this device.</p>;
  const ink = stall.payload.t ?? "#003087";
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-6 print:p-0">
      <style>{`@page { size: A5 portrait; margin: 10mm } @media print { header, nav, .no-print { display: none !important } body { background: #fff !important } }`}</style>
      <Button variant="action" onClick={() => window.print()} className="no-print">
        <Printer /> Print or save as PDF
      </Button>
      <article className="mx-auto flex aspect-[148/210] w-full flex-col items-center justify-between rounded-xl border bg-white p-8 text-center text-[#1b1b1f] shadow-sm print:border-0 print:shadow-none">
        <div>
          <p className="font-hand text-3xl" style={{ color: ink }}>
            {stall.payload.k ?? "pay here"}
          </p>
          <h1 className="font-serif text-5xl leading-tight" style={{ color: ink }}>
            {stall.payload.n}
          </h1>
        </div>
        {stall.sourceImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- the seller's own paper, as a thumbnail
          <img src={stall.sourceImage} alt="" className="max-h-28 rounded opacity-80" />
        ) : null}
        {origin ? <Qr value={stallUrl(origin, stall.signed)} size={260} label="Scan to pay" /> : null}
        <div>
          <p className="font-serif text-4xl" style={{ color: ink }}>
            Scan to pay
          </p>
          <p className="text-sm text-[#5b5a60]">Pick what you want and pay with PayPal. Show your receipt at the stall.</p>
        </div>
      </article>
    </div>
  );
}
