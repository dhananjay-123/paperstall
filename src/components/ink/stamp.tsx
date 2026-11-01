"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type StampKind = "shop" | "invoice" | "monthly" | "paid" | "unknown";

const STYLE: Record<StampKind, { label: string; className: string }> = {
  shop: { label: "SHOP", className: "text-action border-action" },
  invoice: { label: "INVOICE", className: "text-ink border-ink" },
  monthly: { label: "MONTHLY", className: "text-success-ink border-success-ink" },
  paid: { label: "PAID", className: "text-success-ink border-success-ink" },
  unknown: { label: "NOT SURE", className: "text-warning-ink border-warning-ink" },
};

type StampProps = {
  kind: StampKind;
  /** Overrides the default label, e.g. "WEEKLY". */
  label?: string;
  rotate?: number;
  playKey?: number;
  className?: string;
};

/** A rubber stamp that thunks onto the paper. */
export function Stamp({ kind, label, rotate = -6, playKey = 0, className }: StampProps) {
  const reduce = useReducedMotion();
  const s = STYLE[kind];

  return (
    <motion.span
      key={playKey}
      role="status"
      initial={reduce ? false : { scale: 1.8, opacity: 0, rotate: rotate - 8 }}
      animate={{ scale: 1, opacity: 1, rotate }}
      transition={{ type: "spring", stiffness: 520, damping: 22, mass: 0.8 }}
      className={cn(
        "inline-flex select-none items-center rounded-md border-[3px] border-double px-3 py-1",
        "font-sans text-sm font-black tracking-[0.22em] uppercase",
        // A faint mask makes the ink look unevenly pressed.
        "[mask-image:radial-gradient(circle_at_30%_40%,#000_55%,rgb(0_0_0/0.75)_100%)]",
        s.className,
        className,
      )}
    >
      {label ?? s.label}
    </motion.span>
  );
}
