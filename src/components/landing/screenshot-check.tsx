"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { CircleCheck, CircleX, RotateCcw, ScanLine } from "lucide-react";
import { InkCircle } from "@/components/ink/ink-circle";
import { cn } from "@/lib/utils";

type Shot = {
  id: "a" | "b";
  orderId: string;
  time: string;
  real: boolean;
};

// Two screenshots a customer could show at the counter. They look the same on purpose.
// This is an illustration of the check (no network call), and it says so on the page;
// the real check runs against PayPal on /verify.
const SHOTS: Shot[] = [
  { id: "a", orderId: "6VU297505J010243X", time: "12:41", real: true },
  { id: "b", orderId: "6VU29750SJ0I0243X", time: "12:41", real: false },
];

type State = "idle" | "scanning" | "done";

export function ScreenshotCheck() {
  const [state, setState] = useState<Record<Shot["id"], State>>({ a: "idle", b: "idle" });
  const reduce = useReducedMotion();

  const scan = (id: Shot["id"]) => {
    setState((s) => ({ ...s, [id]: "scanning" }));
    setTimeout(() => setState((s) => ({ ...s, [id]: "done" })), reduce ? 200 : 1500);
  };

  return (
    <figure className="space-y-4">
      <div className="grid gap-6 sm:grid-cols-2">
        {SHOTS.map((shot) => {
          const st = state[shot.id];
          return (
            <div key={shot.id} className="flex flex-col items-center gap-4">
              <div className="relative w-full max-w-[260px]">
                <div className={cn("rounded-[1.6rem] bg-graphite p-[5px] transition-transform dark:bg-black", st === "done" && !shot.real && "rotate-1")}>
                  <div className="relative overflow-hidden rounded-[1.35rem] bg-white px-5 pt-8 pb-6 text-center text-[#1b1b1f]">
                    <p className="text-xs text-[#5b5a60]">You sent</p>
                    <p className="text-4xl font-bold tracking-tight tabular-nums">$21.00</p>
                    <p className="mt-1 text-sm">to Tacos Doña María</p>
                    <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#e7f6ee] px-2.5 py-1 text-xs font-medium text-[#067049]">
                      <CircleCheck className="size-3.5" /> Completed
                    </p>
                    <dl className="mt-5 space-y-1 border-t pt-3 text-left text-[11px] text-[#5b5a60]">
                      <div className="flex justify-between gap-2">
                        <dt>Today</dt>
                        <dd>{shot.time}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Transaction</dt>
                        <dd className="relative font-mono">
                          <OrderId id={shot.orderId} reveal={st === "done" && !shot.real} />
                          {st === "done" && !shot.real ? <InkCircle box={[0, 0, 1000, 1000]} seed={9} color="var(--danger)" strokeWidth={2} /> : null}
                        </dd>
                      </div>
                    </dl>
                    {/* Scan line */}
                    <AnimatePresence>
                      {st === "scanning" ? (
                        <motion.div
                          className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-[#0070e0]/25 to-transparent"
                          initial={{ top: "-15%" }}
                          animate={{ top: ["-15%", "95%", "-15%"] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1.4, ease: "easeInOut" }}
                        />
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="flex min-h-[4.5rem] w-full max-w-[300px] flex-col items-center text-center" aria-live="polite">
                {st === "idle" ? (
                  <button
                    type="button"
                    onClick={() => scan(shot.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-primary-foreground outline-none hover:bg-ink/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ScanLine className="size-4" /> Check screenshot {shot.id.toUpperCase()}
                  </button>
                ) : st === "scanning" ? (
                  <p className="py-2 text-sm text-muted-foreground">Checking the transaction ID…</p>
                ) : (
                  <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                    {shot.real ? (
                      <p className="flex items-center justify-center gap-1.5 font-semibold text-success-ink">
                        <CircleCheck className="size-5" /> Paid: $21.00 arrived
                      </p>
                    ) : (
                      <p className="flex items-center justify-center gap-1.5 font-semibold text-danger-ink">
                        <CircleX className="size-5" /> No such payment
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {shot.real ? "Hand over the tacos." : "The transaction ID was edited: a 5 became an S and a 1 became an I. Don’t hand over the order."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setState((s) => ({ ...s, [shot.id]: "idle" }))}
                      className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <RotateCcw className="size-3" /> Again
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        An illustration of what the check shows. In the app, the seller&apos;s phone asks PayPal live.
      </figcaption>
    </figure>
  );
}

const REAL_ID = SHOTS[0].orderId;

/** The transaction ID, with any characters that differ from the real one marked once the check fails. */
function OrderId({ id, reveal }: { id: string; reveal: boolean }) {
  return (
    <>
      {[...id].map((ch, i) => (
        <span key={i} className={cn(reveal && ch !== REAL_ID[i] && "rounded-sm bg-danger/15 font-bold text-danger-ink")}>
          {ch}
        </span>
      ))}
    </>
  );
}
