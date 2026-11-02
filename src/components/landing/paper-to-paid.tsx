"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Pause, Play, ShieldCheck } from "lucide-react";
import { InkCircle, type Box } from "@/components/ink/ink-circle";
import { Stamp } from "@/components/ink/stamp";
import { cn } from "@/lib/utils";
import taco from "../../../public/samples/taco-stand.read.json";

// The film plays the real cached Read of the taco-stand sample: same boxes, same names, same prices.
const ITEMS = taco.items.map((i) => ({ id: i.id, original: i.nameOriginal, name: i.nameEn, price: i.unitPrice, box: i.box as unknown as Box }));
const CART: Record<string, number> = { "tacos-pastor": 2, "agua-horchata": 1 };
const TOTAL = ITEMS.reduce((sum, i) => sum + (CART[i.id] ?? 0) * i.price, 0);

const STEPS = [
  { label: "Snap", note: "Maria photographs her chalkboard", ms: 2600 },
  { label: "Read", note: "Each item is circled and translated", ms: 3800 },
  { label: "Sell", note: "Customers order from their phone", ms: 3800 },
  { label: "Paid", note: "PayPal confirms the money arrived", ms: 4200 },
] as const;

const EASE = [0.65, 0, 0.35, 1] as const;

export function PaperToPaid() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on every step change so the progress bar and ink replay from the start.
  const [run, setRun] = useState(0);

  const playing = !reduce && !paused && inView;

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setStep((s) => (s + 1) % STEPS.length);
      setRun((r) => r + 1);
    }, STEPS[step].ms);
    return () => clearTimeout(t);
  }, [playing, step, run]);

  const go = (i: number) => {
    setStep(i);
    setRun((r) => r + 1);
  };

  return (
    <div ref={ref} className="w-full">
      <div className="relative mx-auto aspect-[10/9] w-full max-w-[560px]">
        {/* The chalkboard */}
        <motion.div
          className="absolute top-[3%] left-0 w-[60%] origin-bottom-left"
          initial={false}
          animate={{ rotate: step === 0 ? -1 : -3, scale: step >= 2 ? 0.94 : 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <div className="relative overflow-hidden rounded-md shadow-[0_18px_40px_-18px_rgb(20_30_25/0.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static sample, sized by its box */}
            <img src="/samples/taco-stand.jpg" alt="Tacos Doña María, a chalkboard menu in Spanish with seven prices" width={933} height={1128} className="block h-auto w-full" />
            {step >= 1
              ? ITEMS.map((item, i) => (
                  <InkCircle key={item.id} box={item.box} seed={i + 3} delay={0.25 + i * 0.32} color="var(--chalk)" blend={false} strokeWidth={2.25} playKey={step === 1 ? run : 0} />
                ))
              : null}
            <AnimatePresence>
              {step === 0 ? <Viewfinder key={run} reduce={!!reduce} /> : null}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* The phone */}
        <div className="absolute right-0 bottom-0 w-[46%]">
          <div className="rounded-[2rem] bg-graphite p-[5px] shadow-[0_30px_60px_-24px_rgb(0_20_60/0.55)] dark:bg-black">
            <div className="relative aspect-[9/17] overflow-hidden rounded-[1.7rem] bg-card text-card-foreground">
              <div className="absolute top-1.5 left-1/2 z-20 h-3.5 w-14 -translate-x-1/2 rounded-full bg-graphite dark:bg-black" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  className="absolute inset-0 flex flex-col pt-7"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  {step === 0 ? <PhoneCamera /> : step === 1 ? <PhoneRead run={run} /> : step === 2 ? <PhoneShop run={run} /> : <PhonePaid run={run} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
        {/* A hand-drawn arrow from the board to the phone */}
        <svg aria-hidden viewBox="0 0 120 80" className="pointer-events-none absolute top-[-4%] left-[50%] z-10 w-[18%] overflow-visible text-action">
          {step >= 1 ? (
            <motion.path
              key={step === 1 ? run : "arrow"}
              d="M6 14 C 40 0, 86 8, 104 52 M92 44 L104 54 L110 40"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: step === 1 ? 2.4 : 0, ease: EASE }}
            />
          ) : null}
        </svg>
      </div>

      {/* Scrubber */}
      <div className="mx-auto mt-6 flex w-full max-w-[560px] items-start gap-2">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play the walkthrough" : "Pause the walkthrough"}
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border bg-card text-ink outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          hidden={!!reduce}
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
        <ol className="grid flex-1 grid-cols-4 gap-2">
          {STEPS.map((s, i) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                className="group w-full rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="block h-1 overflow-hidden rounded-full bg-border">
                  <span
                    key={i === step ? run : "idle"}
                    className={cn("block h-full rounded-full bg-ink", i < step ? "w-full" : "w-0")}
                    style={i === step ? (playing ? { animation: `ps-fill ${s.ms}ms linear forwards` } : { width: "100%" }) : undefined}
                  />
                </span>
                <span className={cn("mt-2 block text-sm font-semibold", i === step ? "text-ink" : "text-muted-foreground group-hover:text-foreground")}>
                  {i + 1}. {s.label}
                </span>
                <span className="hidden text-xs leading-snug text-muted-foreground sm:block">{s.note}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Viewfinder({ reduce }: { reduce: boolean }) {
  const corner = "absolute size-7 border-white/90";
  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="absolute inset-[7%]"
        initial={reduce ? false : { scale: 1.12, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <span className={cn(corner, "top-0 left-0 rounded-tl-md border-t-2 border-l-2")} />
        <span className={cn(corner, "top-0 right-0 rounded-tr-md border-t-2 border-r-2")} />
        <span className={cn(corner, "bottom-0 left-0 rounded-bl-md border-b-2 border-l-2")} />
        <span className={cn(corner, "right-0 bottom-0 rounded-br-md border-r-2 border-b-2")} />
      </motion.div>
      {/* Shutter flash */}
      {reduce ? null : (
        <motion.div
          className="absolute inset-0 bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 0.85, 0] }}
          transition={{ duration: 2, times: [0, 0.72, 0.78, 1] }}
        />
      )}
    </motion.div>
  );
}

function PhoneCamera() {
  return (
    <div className="-mt-7 flex flex-1 flex-col items-center justify-center gap-3 bg-slate px-4 pt-7 text-center text-white/90">
      <p className="font-hand text-2xl leading-tight text-chalk">point at your price list</p>
      <span className="grid size-12 place-items-center rounded-full border-[3px] border-white/80">
        <Camera className="size-5" />
      </span>
    </div>
  );
}

function PhoneRead({ run }: { run: number }) {
  return (
    <div className="flex flex-1 flex-col px-3.5">
      <p className="text-[11px] text-muted-foreground">Read from Spanish, in English</p>
      <p className="text-sm leading-tight font-bold tracking-tight text-ink">{taco.business.name}</p>
      <ul className="mt-2 space-y-1.5">
        {ITEMS.map((item, i) => (
          <motion.li
            key={`${run}-${item.id}`}
            className="flex items-baseline justify-between gap-2 border-b border-dashed pb-1 text-xs leading-tight"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 + i * 0.32, duration: 0.3 }}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.name}</span>
              <span className="block truncate font-hand text-xs text-muted-foreground">{item.original}</span>
            </span>
            <span className="font-semibold tabular-nums">${item.price}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function PhoneShop({ run }: { run: number }) {
  // Quantities tick up one at a time, like a customer tapping.
  const [qty, setQty] = useState<Record<string, number>>({});
  useEffect(() => {
    const taps = [
      ["tacos-pastor", 1, 700],
      ["tacos-pastor", 2, 1300],
      ["agua-horchata", 1, 2000],
    ] as const;
    const timers = taps.map(([id, n, ms]) => setTimeout(() => setQty((q) => ({ ...q, [id]: n })), ms));
    return () => timers.forEach(clearTimeout);
  }, [run]);
  const total = ITEMS.reduce((s, i) => s + (qty[i.id] ?? 0) * i.price, 0);

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-3.5">
        <p className="text-sm leading-tight font-bold tracking-tight text-ink">{taco.business.name}</p>
        <p className="text-[11px] text-muted-foreground">Order at the counter, pay on your phone</p>
      </div>
      <ul className="mt-3 flex-1 space-y-0.5 overflow-hidden px-2.5">
        {ITEMS.map((item) => {
          const n = qty[item.id] ?? 0;
          return (
            <li key={item.id} className={cn("flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-xs transition-colors", n && "bg-accent")}>
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className="text-muted-foreground">${item.price}</span>
                <motion.span
                  key={n}
                  initial={n ? { scale: 1.6 } : false}
                  animate={{ scale: 1 }}
                  className={cn("grid size-5 place-items-center rounded-full text-[10px] font-bold", n ? "bg-ink text-primary-foreground dark:bg-action dark:text-white" : "border text-muted-foreground")}
                >
                  {n || "+"}
                </motion.span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="p-2.5">
        <div className="flex items-center justify-center gap-1 rounded-full bg-[#ffc439] py-2.5 text-xs font-bold text-[#003087]">
          Pay <span className="tabular-nums">${total.toFixed(2)}</span> with <span className="italic">PayPal</span>
        </div>
      </div>
    </div>
  );
}

function PhonePaid({ run }: { run: number }) {
  return (
    <div className="flex flex-1 flex-col items-center px-3.5 pt-4 text-center">
      <motion.span
        key={run}
        className="grid size-12 place-items-center rounded-full bg-success text-white"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
      >
        <Check className="size-6" strokeWidth={3} />
      </motion.span>
      <p className="mt-2 text-3xl font-bold tracking-tight text-ink tabular-nums">${TOTAL.toFixed(2)}</p>
      <p className="text-xs text-muted-foreground">Payment received</p>
      <div className="mt-4 w-full rounded-md border border-dashed bg-background/60 px-2.5 py-2 text-left text-[11px] leading-relaxed">
        {Object.entries(CART).map(([id, n]) => (
          <p key={id} className="flex justify-between gap-2">
            <span className="truncate">{ITEMS.find((i) => i.id === id)?.name}</span>
            <span className="tabular-nums">×{n}</span>
          </p>
        ))}
      </div>
      <div className="mt-5">
        <Stamp kind="paid" rotate={-8} playKey={run} className="px-4 py-1 text-base" />
      </div>
      <p className="mt-auto mb-3 flex items-center gap-1 text-[11px] font-medium text-success-ink">
        <ShieldCheck className="size-3.5 shrink-0" /> Checked with PayPal, not a screenshot
      </p>
    </div>
  );
}
