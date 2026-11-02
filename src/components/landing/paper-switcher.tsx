"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { InkCircle, type Box } from "@/components/ink/ink-circle";
import { Stamp, type StampKind } from "@/components/ink/stamp";
import { cn } from "@/lib/utils";
import coffee from "../../../public/samples/coffee-cart.read.json";
import bill from "../../../public/samples/freelancer-bill.read.json";
import piano from "../../../public/samples/piano-lessons.read.json";
import phones from "../../../public/samples/phone-accessories.read.json";

type Line = { name: string; price: string; box: Box };
type Paper = {
  id: string;
  tab: string;
  image: string;
  alt: string;
  stamp: StampKind;
  becomes: string;
  detail: string;
  business: string;
  reason: string;
  lines: Line[];
  /** Chalkboards get chalk-coloured circles; ink would vanish on them. */
  chalk?: boolean;
};

const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const box = (b: number[]) => b as unknown as Box;

// Every value below comes from a cached Read of the sample photo; nothing is typed in by hand.
const PAPERS: Paper[] = [
  {
    id: "coffee",
    tab: "Coffee cart",
    image: "/samples/coffee-cart.jpg",
    alt: "Rosa's Coffee Cart chalkboard with drinks and pastries",
    stamp: "shop",
    chalk: true,
    becomes: "A storefront with PayPal Checkout",
    detail: "Customers scan your poster, pick items and pay. Add-ons like oat milk stay as notes, not products.",
    business: coffee.business.name,
    reason: coffee.intentReason,
    lines: coffee.items.map((i) => ({ name: i.nameEn, price: usd(i.unitPrice), box: box(i.box) })),
  },
  {
    id: "bill",
    tab: "Freelancer's bill",
    image: "/samples/freelancer-bill.jpg",
    alt: "A handwritten invoice from Sam Lee Design to Bloom Florist",
    stamp: "invoice",
    becomes: "A PayPal invoice, emailed with a QR code",
    detail: `Customer, dates and lines come off the page. The written total (${usd(bill.writtenTotal)}) is checked against the lines before anything is sent.`,
    business: bill.business.name,
    reason: bill.intentReason,
    lines: [
      ...bill.items.map((i) => ({ name: i.nameEn, price: usd(i.unitPrice), box: box(i.box) })),
      { name: "Written total", price: usd(bill.writtenTotal), box: box(bill.writtenTotalBox) },
    ],
  },
  {
    id: "piano",
    tab: "Lessons notice",
    image: "/samples/piano-lessons.jpg",
    alt: "A notice for piano lessons at $120 a month",
    stamp: "monthly",
    becomes: "A PayPal subscription plan",
    detail: "“$120/month” becomes a plan parents approve once. Payments repeat without anyone chasing them.",
    business: piano.business.name,
    reason: piano.intentReason,
    lines: piano.items.map((i) => ({ name: i.nameEn, price: `${usd(i.unitPrice)}/mo`, box: box(i.box) })),
  },
  {
    id: "phones",
    tab: "Phone stall",
    image: "/samples/phone-accessories.jpg",
    alt: "A phone accessories price board with branded items",
    stamp: "shop",
    becomes: "A storefront, with a market price check",
    detail: "Branded items like a JBL speaker are compared with what US stores charge, so a typo in a price gets caught.",
    business: phones.business.name,
    reason: phones.intentReason,
    lines: phones.items.map((i) => ({ name: i.nameEn, price: usd(i.unitPrice), box: box(i.box) })),
  },
];

export function PaperSwitcher() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const p = PAPERS[active];

  return (
    <div>
      <div role="tablist" aria-label="Sample paper" className="flex gap-1 overflow-x-auto pb-1">
        {PAPERS.map((x, i) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            id={`paper-tab-${x.id}`}
            aria-selected={i === active}
            aria-controls="paper-panel"
            onClick={() => setActive(i)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              i === active ? "border-ink bg-ink text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {x.tab}
          </button>
        ))}
      </div>

      <div id="paper-panel" role="tabpanel" aria-labelledby={`paper-tab-${p.id}`} className="mt-6 grid items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={p.id}
            className="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-md shadow-[0_18px_40px_-18px_rgb(20_30_25/0.55)]"
            initial={reduce ? false : { opacity: 0, rotate: -4, y: 16 }}
            animate={{ opacity: 1, rotate: -1.5, y: 0 }}
            exit={{ opacity: 0, rotate: 2, y: -10 }}
            transition={{ duration: 0.4, ease: [0.65, 0, 0.35, 1] }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static sample */}
            <img src={p.image} alt={p.alt} width={940} height={1135} className="block h-auto w-full" />
            {p.lines.map((l, i) => (
              <InkCircle key={l.name} box={l.box} seed={i + 1} delay={0.3 + i * 0.12} {...(p.chalk ? { color: "var(--chalk)", blend: false, strokeWidth: 2 } : {})} />
            ))}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={p.id}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Stamp kind={p.stamp} playKey={active} />
              <p className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{p.becomes}</p>
            </div>
            <p className="max-w-prose text-muted-foreground">{p.detail}</p>
            <figure className="rounded-lg border bg-card p-4">
              <figcaption className="text-sm text-muted-foreground">
                What the Read wrote about <span className="font-medium text-foreground">{p.business}</span>
              </figcaption>
              <blockquote className="mt-1 font-hand text-2xl leading-snug text-action">{p.reason}</blockquote>
              <ul className="mt-3 grid gap-x-6 gap-y-1 border-t border-dashed pt-3 text-sm sm:grid-cols-2">
                {p.lines.slice(0, 6).map((l) => (
                  <li key={l.name} className="flex justify-between gap-3">
                    <span className="truncate">{l.name}</span>
                    <span className="font-medium tabular-nums">{l.price}</span>
                  </li>
                ))}
              </ul>
              {p.lines.length > 6 ? <p className="mt-1 text-xs text-muted-foreground">and {p.lines.length - 6} more</p> : null}
            </figure>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
