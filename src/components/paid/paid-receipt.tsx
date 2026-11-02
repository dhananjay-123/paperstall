"use client";

import { motion, useReducedMotion } from "motion/react";
import { Stamp } from "@/components/ink/stamp";
import { formatMoney } from "@/core/money";

type Props = {
  title: string;
  totalMinor: number;
  currency: string;
  items: { name: string; quantity: number }[];
  at?: string;
  orderId: string;
  playKey?: number;
  /** From PayPal: set once the seller refunds some or all of the order. */
  refundedMinor?: number;
};

/** The "Paid" moment: a receipt slides out of the printer slot. */
export function PaidReceipt({ title, totalMinor, currency, items, at, orderId, playKey = 0, refundedMinor = 0 }: Props) {
  const fully = refundedMinor >= totalMinor;
  const reduce = useReducedMotion();
  const time = at ? new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  return (
    <div className="relative mx-auto w-full max-w-xs">
      <div className="relative z-10 h-4 rounded-full bg-ink shadow-md" aria-hidden />
      <div className="-mt-2 overflow-hidden px-3">
        <motion.div
          key={playKey}
          initial={reduce ? false : { y: "-100%" }}
          animate={{ y: 0 }}
          transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative bg-white px-5 pt-6 pb-5 font-mono text-sm text-graphite shadow-lg [clip-path:polygon(0_0,100%_0,100%_calc(100%-8px),95%_100%,90%_calc(100%-8px),85%_100%,80%_calc(100%-8px),75%_100%,70%_calc(100%-8px),65%_100%,60%_calc(100%-8px),55%_100%,50%_calc(100%-8px),45%_100%,40%_calc(100%-8px),35%_100%,30%_calc(100%-8px),25%_100%,20%_calc(100%-8px),15%_100%,10%_calc(100%-8px),5%_100%,0_calc(100%-8px))]"
          role="status"
          aria-live="polite"
        >
          <p className="text-center font-sans text-xs tracking-widest text-muted-foreground uppercase">{title}</p>
          <p className="mt-2 text-center font-serif text-4xl text-[#003087] tabular-nums">{formatMoney(totalMinor, currency)}</p>
          {refundedMinor > 0 ? (
            <p className="mt-1 text-center font-sans text-xs font-semibold text-[#9a4a00]">
              {fully ? "Refunded in full" : `Partly refunded ${formatMoney(refundedMinor, currency)}`}
            </p>
          ) : null}
          <ul className="mt-3 space-y-0.5 border-t border-dashed pt-3 text-xs">
            {items.map((i) => (
              <li key={i.name} className="flex justify-between gap-2">
                <span className="truncate">{i.name}</span>
                <span>×{i.quantity}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-dashed pt-2 text-[10px] text-muted-foreground">
            {time ? `${time} · ` : ""}PayPal {orderId}
          </p>
          <div className="absolute top-10 right-3">
            {fully ? null : <Stamp kind="paid" rotate={-12} playKey={playKey} className="bg-white/70 text-xs" />}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
