"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowRight, Ban, Plus, RotateCcw, Trash2 } from "lucide-react";
import { InkCircle, type Box } from "@/components/ink/ink-circle";
import { Stamp, type StampKind } from "@/components/ink/stamp";
import { MarketChip } from "@/components/read/market-chip";
import { Button } from "@/components/ui/button";
import type { MarketMatch } from "@/core/market";
import { priceGuard } from "@/core/market";
import { formatMoney, isPayPalCurrency, PAYPAL_CURRENCIES, toMinor, type CurrencyCode } from "@/core/money";
import { computedTotalMinor, mathCheck, sanityFlags, taxMinorOf, taxRateBp } from "@/core/read/checks";
import type { Intent, Read, ReadItem } from "@/core/read/schema";
import { api, ApiCallError } from "@/lib/api-client";
import { dataUrlToBase64 } from "@/lib/image";
import { getCached, putCached } from "@/lib/market-cache";
import { SAMPLES } from "@/lib/samples";
import { useStore, type DraftRead } from "@/lib/store";
import { cn } from "@/lib/utils";

type Phase = { kind: "reading" } | { kind: "waiting"; until: number; message: string } | { kind: "error"; message: string; debugId?: string; quota?: boolean } | { kind: "done" };

const STAMP: Record<Intent, StampKind> = { shop: "shop", invoice: "invoice", subscription: "monthly", unknown: "unknown" };
const INTENT_LABEL: Record<Exclude<Intent, "unknown">, string> = { shop: "Shop", invoice: "Invoice", subscription: "Subscription" };

export function ReadClient() {
  const router = useRouter();
  const draft = useStore((s) => s.draft);
  const patchDraft = useStore((s) => s.patchDraft);
  const [phase, setPhase] = useState<Phase>(draft?.read ? { kind: "done" } : { kind: "reading" });
  const inFlight = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  const runRead = useCallback(async () => {
    const d = useStore.getState().draft;
    if (!d || inFlight.current) return;
    inFlight.current = true; // one in-flight Read per client
    setPhase({ kind: "reading" });
    try {
      const res = await api<{ read: Read; aup: { id: string; reason: string }[] | null; aupChecked: boolean }>("/api/v1/ai/read", {
        body: { image: dataUrlToBase64(d.imageDataUrl) },
      });
      patchDraft({ read: res.read, aup: res.aup ?? [], aupChecked: res.aupChecked, cached: false });
      setPhase({ kind: "done" });
    } catch (e) {
      if (e instanceof ApiCallError && e.error.code === "AI_DAILY_LIMIT") {
        // A daily cap won't lift in a minute: say so and offer the cached samples instead of retrying.
        setPhase({ kind: "error", message: e.error.message, quota: true });
      } else if (e instanceof ApiCallError && e.status === 429) {
        const secs = Math.min(90, e.error.retryAfter ?? 20);
        setPhase({ kind: "waiting", until: Date.now() + secs * 1000, message: e.error.message });
      } else {
        setPhase({
          kind: "error",
          message: e instanceof ApiCallError ? e.error.message : "Couldn't reach the server. Check your connection.",
          debugId: e instanceof ApiCallError ? e.error.debugId : undefined,
        });
      }
    } finally {
      inFlight.current = false;
    }
  }, [patchDraft]);

  // Kick off the Read when the page opens with a fresh draft. The in-flight guard (not a
  // "started" flag) prevents duplicates, so React's dev remount can't cancel it for good.
  const draftId = draft?.id;
  const hasRead = Boolean(draft?.read);
  useEffect(() => {
    if (!draftId || hasRead) return;
    const t = setTimeout(() => void runRead(), 0);
    return () => clearTimeout(t);
  }, [draftId, hasRead, runRead]);

  // "Ink is drying, retrying in Ns": tick, then retry automatically.
  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= phase.until) {
        clearInterval(id);
        void runRead();
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase, runRead]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-ink">Nothing to read yet</h1>
        <p className="text-muted-foreground">Take a photo of your paper first.</p>
        <Button variant="action" asChild>
          <Link href="/new">Snap your paper</Link>
        </Button>
      </div>
    );
  }

  const sample = draft.sampleId ? SAMPLES.find((s) => s.id === draft.sampleId) : undefined;

  async function useCachedSample() {
    if (!sample) return;
    try {
      const res = await fetch(sample.cached);
      if (!res.ok) throw new Error();
      const parsed = (await res.json()) as Read;
      patchDraft({ read: parsed, cached: true, aup: [], aupChecked: false });
      setPhase({ kind: "done" });
    } catch {
      setPhase({ kind: "error", message: "No cached result is available for this sample." });
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-10">
      <PaperPane draft={draft} phase={phase} />
      <div className="space-y-5">
        {phase.kind === "reading" ? <ReadingSkeleton /> : null}
        {phase.kind === "waiting" ? (
          <div aria-live="polite" className="space-y-3 rounded-xl border bg-card p-5">
            <p className="font-serif text-2xl text-ink">Ink is drying…</p>
            <p className="text-sm text-muted-foreground">
              The AI is busy (free tier). Retrying in {Math.max(0, Math.ceil((phase.until - now) / 1000))}s.
            </p>
            {sample ? (
              <Button variant="outline" size="sm" onClick={useCachedSample}>
                Use a cached result from a real earlier run
              </Button>
            ) : null}
          </div>
        ) : null}
        {phase.kind === "error" ? (
          <div role="alert" className="space-y-3 rounded-xl border border-danger/40 bg-card p-5">
            <p className="font-serif text-2xl text-danger-ink">{phase.quota ? "Out of AI reads for today" : "Couldn’t read that"}</p>
            <p className="text-sm">{phase.message}</p>
            {phase.debugId ? <p className="font-mono text-xs text-muted-foreground">debug_id {phase.debugId}</p> : null}
            <div className="flex flex-wrap gap-2">
              {phase.quota && sample ? (
                <Button variant="action" size="sm" onClick={useCachedSample}>
                  Use a cached result from a real earlier run
                </Button>
              ) : phase.quota ? (
                <Button variant="action" size="sm" asChild>
                  <Link href="/new?mode=samples">Try a sample</Link>
                </Button>
              ) : (
                <Button variant="action" size="sm" onClick={() => void runRead()}>
                  <RotateCcw /> Try again
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href="/new">Use another photo</Link>
              </Button>
            </div>
          </div>
        ) : null}
        {phase.kind === "done" && draft.read ? <ReadEditor draft={draft} onContinue={(intent) => router.push(`/new/publish?intent=${intent}`)} /> : null}
      </div>
    </div>
  );
}

function ReadingSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-3 rounded-xl border bg-card p-5">
      <p className="font-serif text-2xl text-ink">Reading your paper…</p>
      <p className="text-sm text-muted-foreground">Finding items, prices and what this paper is for.</p>
      {[70, 55, 62, 48].map((w, i) => (
        <div key={i} className="h-9 rounded-lg ink-shimmer" style={{ width: `${w + 30}%` }} />
      ))}
    </div>
  );
}

// Average brightness of a small copy of the photo: chalkboards need chalk-coloured circles.
function isDarkImage(img: HTMLImageElement): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 32, 32);
    const px = ctx.getImageData(0, 0, 32, 32).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    return sum / (px.length / 4) < 100;
  } catch {
    return false;
  }
}

function PaperPane({ draft, phase }: { draft: DraftRead; phase: Phase }) {
  const reduce = useReducedMotion();
  const [dark, setDark] = useState(false);
  const read = draft.read;
  const currency = read ? effectiveCurrency(draft) : null;
  const math = read && currency ? mathCheck(read, currency) : null;
  const ink = dark ? { color: "var(--chalk)", blend: false, strokeWidth: 2.25 } : { color: "var(--action)" };
  return (
    <div className="lg:sticky lg:top-20 lg:self-start">
      <div className="relative overflow-hidden rounded-2xl border bg-white shadow-[0_18px_40px_-22px_rgb(20_30_25/0.5)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL of the seller's own photo */}
        <img src={draft.imageDataUrl} alt="Your paper" className="block h-auto w-full" onLoad={(e) => setDark(isDarkImage(e.currentTarget))} />
        {phase.kind === "reading" ? (
          reduce ? (
            <div className="absolute inset-0 bg-sky/10" />
          ) : (
            <motion.div
              aria-hidden
              className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-sky/30 to-transparent"
              initial={{ top: "-20%" }}
              animate={{ top: ["-20%", "100%"] }}
              transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
            >
              <div className="absolute inset-x-0 top-1/2 h-px bg-sky" />
            </motion.div>
          )
        ) : null}
        {read?.items.map((it, i) => (
          <InkCircle key={it.id} box={it.box as unknown as Box} seed={i + 3} delay={0.15 + i * 0.12} {...ink} />
        ))}
        {math && !math.ok && read?.writtenTotalBox ? (
          <InkCircle box={read.writtenTotalBox as unknown as Box} seed={99} delay={0.3 + read.items.length * 0.12} color="var(--danger)" blend={!dark} />
        ) : null}
        {draft.cached ? (
          <span className="absolute top-3 left-3 rounded-full bg-warning px-2 py-0.5 text-xs font-medium text-white">cached result</span>
        ) : null}
      </div>
      {read ? (
        <motion.p
          className="mt-3 text-center font-hand text-xl text-action"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 + read.items.length * 0.12 }}
        >
          {read.items.length === 1 ? "found 1 item" : `found ${read.items.length} items`}
          {read.sourceLanguage && read.sourceLanguage !== "en" ? ", translated to English" : ""}
        </motion.p>
      ) : null}
    </div>
  );
}

export function effectiveCurrency(draft: DraftRead): CurrencyCode | null {
  const c = (draft.currency ?? draft.read?.currency.detected ?? "").toUpperCase();
  return isPayPalCurrency(c) ? c : null;
}

function ReadEditor({ draft, onContinue }: { draft: DraftRead; onContinue: (intent: Exclude<Intent, "unknown">) => void }) {
  const patchDraft = useStore((s) => s.patchDraft);
  const read = draft.read!;
  const reduce = useReducedMotion();
  const currency = effectiveCurrency(draft);
  const fmt = (n: number) => (currency ? formatMoney(toMinor(n, currency), currency) : String(n));
  const [stampKey, setStampKey] = useState(0);

  const update = (next: Partial<Read>) => patchDraft({ read: { ...read, ...next }, edits: draft.edits + 1 });
  const setItem = (id: string, p: Partial<ReadItem>) => update({ items: read.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  // The last removed item, so a mis-tap can be undone in place.
  const [removed, setRemoved] = useState<{ item: ReadItem; index: number } | null>(null);
  const removeItem = (index: number) => {
    setRemoved({ item: read.items[index], index });
    update({ items: read.items.filter((_, i) => i !== index) });
  };
  const undoRemove = () => {
    if (!removed) return;
    const items = [...read.items];
    items.splice(Math.min(removed.index, items.length), 0, removed.item);
    update({ items });
    setRemoved(null);
  };

  // Market check for branded items, cached 24h per query. Never blocks anything.
  const marketQueries = useMemo(
    () => read.items.filter((i) => i.retail?.isBrandedProduct && i.retail.searchQuery).map((i) => ({ id: i.id, query: i.retail!.searchQuery! })),
    [read.items],
  );
  const askedMarket = useRef(false);
  useEffect(() => {
    if (askedMarket.current || !currency || !marketQueries.length || draft.market) return;
    askedMarket.current = true;
    const result: Record<string, MarketMatch | null> = {};
    const missing = marketQueries.filter((q) => {
      const c = getCached(q.query, currency);
      if (c) result[q.id] = c.match;
      return !c;
    });
    if (!missing.length) {
      patchDraft({ market: result });
      return;
    }
    api<{ enabled: boolean; matches: Record<string, MarketMatch | null> }>("/api/v1/market", { body: { currency, items: missing.slice(0, 10) } })
      .then((r) => {
        if (!r.enabled) return;
        for (const q of missing) {
          const m = r.matches[q.id] ?? null;
          result[q.id] = m;
          putCached(q.query, currency, m);
        }
        patchDraft({ market: result });
      })
      .catch(() => {
        // Market chips simply don't appear.
      });
  }, [currency, marketQueries, draft.market, patchDraft]);

  const flags = sanityFlags(read);
  const math = currency ? mathCheck(read, currency) : null;
  const aupBlocked = new Map((draft.aup ?? []).map((a) => [a.id, a.reason]));
  const questions = read.questions.filter((q) => !(draft.answered ?? []).includes(q.id));
  const blocking = flags.some((f) => f.severity === "block") || aupBlocked.size > 0 || !currency || read.items.length === 0;
  const intent = read.intent;

  function answer(qid: string, option: string) {
    const o = option.trim();
    const answered = [...(draft.answered ?? []), qid];
    const code = o.toUpperCase().match(/\b[A-Z]{3}\b/)?.[0];
    if (code && isPayPalCurrency(code)) return patchDraft({ currency: code, answered, edits: draft.edits + 1 });
    const interval = /week/i.test(o) ? "week" : /month/i.test(o) ? "month" : /year|annual/i.test(o) ? "year" : null;
    if (interval) return patchDraft({ read: { ...read, items: read.items.map((i) => ({ ...i, interval })) }, answered, edits: draft.edits + 1 });
    patchDraft({ answered, read: { ...read, warnings: [...read.warnings, `You answered “${o}”.`] } });
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="intent-h" className="space-y-3 rounded-xl border bg-card p-5">
        <h2 id="intent-h" className="sr-only">
          What this paper is
        </h2>
        <div className="flex flex-wrap items-start gap-4">
          <Stamp kind={STAMP[intent]} label={intent === "subscription" ? intervalLabel(read) : undefined} playKey={stampKey} />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-2xl leading-tight text-ink">{read.business.name ?? "Your paper"}</p>
            <p className="text-sm text-muted-foreground">{read.intentReason}</p>
          </div>
        </div>
        <div role="radiogroup" aria-label="Change what to make" className="flex flex-wrap gap-1.5">
          {(Object.keys(INTENT_LABEL) as (keyof typeof INTENT_LABEL)[]).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={intent === k}
              onClick={() => {
                update({ intent: k });
                setStampKey((x) => x + 1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                intent === k ? "border-ink bg-ink text-paper" : "hover:border-ink",
              )}
            >
              {INTENT_LABEL[k]}
            </button>
          ))}
        </div>
      </section>

      {questions.length ? (
        <section aria-label="Questions" className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-action/30 bg-accent p-3">
              <p className="text-sm font-medium">{q.ask}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(q.options?.length ? q.options : ["Yes", "No"]).map((o) => (
                  <button key={o} onClick={() => answer(q.id, o)} className="rounded-full border bg-card px-3 py-1 text-sm hover:border-action focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="items-h" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="items-h" className="font-serif text-2xl text-ink">
            {read.items.length} {read.items.length === 1 ? "item" : "items"}
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Currency</span>
            <select
              value={currency ?? ""}
              onChange={(e) => patchDraft({ currency: e.target.value, edits: draft.edits + 1 })}
              className="rounded-md border bg-card px-2 py-1 text-sm"
              aria-invalid={!currency}
            >
              {!currency ? <option value="">Choose…</option> : null}
              {Object.keys(PAYPAL_CURRENCIES).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {!currency ? (
          <p className="text-sm text-warning-ink">
            {read.currency.detected ? `PayPal can't check out in ${read.currency.detected}. ` : "I couldn't tell the currency. "}Pick the currency buyers will pay in.
          </p>
        ) : null}
        <ul className="space-y-2">
          {read.items.map((it, i) => {
            const m = draft.market?.[it.id] ?? null;
            const guard = m ? priceGuard(it.unitPrice, m, fmt, it.nameEn) : null;
            const blockedReason = aupBlocked.get(it.id);
            const itemFlags = flags.filter((f) => f.itemId === it.id);
            return (
              <motion.li
                key={it.id}
                initial={reduce ? false : { opacity: 0, x: -24, rotate: -1 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                transition={{ delay: 0.2 + i * 0.12, type: "spring", stiffness: 260, damping: 24 }}
                className={cn("rounded-xl border bg-card p-3", blockedReason && "border-danger/50")}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <input
                      value={it.nameEn}
                      onChange={(e) => setItem(it.id, { nameEn: e.target.value })}
                      aria-label={`Name of item ${i + 1}`}
                      className="w-full rounded-md bg-transparent px-1 py-0.5 font-medium outline-none hover:bg-muted focus:bg-muted"
                    />
                    {it.nameOriginal.trim().toLowerCase() !== it.nameEn.trim().toLowerCase() ? (
                      <p className="px-1 font-hand text-lg leading-none text-action">as written: {it.nameOriginal}</p>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-1 text-sm">
                    <span className="sr-only">Price of {it.nameEn}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={Number.isFinite(it.unitPrice) ? it.unitPrice : ""}
                      onChange={(e) => setItem(it.id, { unitPrice: Number(e.target.value) })}
                      className="w-24 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
                    />
                  </label>
                  {intent === "invoice" ? (
                    <label className="flex items-center gap-1 text-sm">
                      <span className="text-muted-foreground">×</span>
                      <span className="sr-only">Quantity</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={it.quantity ?? 1}
                        onChange={(e) => setItem(it.id, { quantity: Math.max(1, Math.round(Number(e.target.value))) })}
                        className="w-16 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
                      />
                    </label>
                  ) : null}
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${it.nameEn}`} onClick={() => removeItem(i)}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 px-1">
                  {it.unit ? <span className="text-xs text-muted-foreground">{it.unit}</span> : null}
                  {it.confidence < 0.6 ? <span className="text-xs text-warning-ink">hard to read, please check</span> : null}
                  {m ? (
                    <MarketChip
                      match={m}
                      usePhoto={draft.usePhoto?.[it.id] ?? false}
                      onUsePhoto={(v) => patchDraft({ usePhoto: { ...(draft.usePhoto ?? {}), [it.id]: v } })}
                      onUsePrice={(n) => setItem(it.id, { unitPrice: n })}
                    />
                  ) : null}
                </div>
                {guard ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-warning/10 px-2.5 py-1.5 text-sm text-warning-ink">
                    <AlertTriangle className="size-4" /> {guard.message}
                    <Button size="xs" variant="outline" onClick={() => setItem(it.id, { unitPrice: guard.fix })}>
                      Fix to {fmt(guard.fix)}
                    </Button>
                  </div>
                ) : null}
                {itemFlags.map((f) => (
                  <p key={f.kind} className={cn("mt-1 px-1 text-sm", f.severity === "block" ? "text-danger-ink" : "text-warning-ink")}>
                    {f.message}
                  </p>
                ))}
                {blockedReason ? (
                  <p className="mt-2 flex items-start gap-1.5 px-1 text-sm text-danger-ink">
                    <Ban className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Can&apos;t be sold with PayPal: {blockedReason}{" "}
                      <a className="underline" href="https://www.paypal.com/us/legalhub/paypal/acceptableuse-full" target="_blank" rel="noopener noreferrer">
                        Acceptable Use Policy
                      </a>
                      . Remove it to continue.
                    </span>
                  </p>
                ) : null}
              </motion.li>
            );
          })}
        </ul>
        {removed && !read.items.some((x) => x.id === removed.item.id) ? (
          <div role="status" className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">Removed “{removed.item.nameEn}”</span>
            <Button variant="outline" size="sm" onClick={undoRemove}>
              <RotateCcw /> Undo
            </Button>
          </div>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            update({
              items: [...read.items, { id: `item-${Date.now().toString(36)}`, nameOriginal: "New item", nameEn: "New item", unitPrice: 1, box: [0, 0, 0, 0], confidence: 1 }],
            })
          }
        >
          <Plus /> Add an item
        </Button>
      </section>

      {currency ? (
        <section aria-label="Totals" className="rounded-xl border bg-card p-4 text-sm">
          {intent === "invoice" || math ? (
            // A bill: one real total, with the tax amount as written.
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatMoney(computedTotalMinor(read, currency), currency)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <label htmlFor="read-tax" className="text-muted-foreground">
                  Tax
                  {intent === "shop" && taxRateBp(read, currency) > 0 ? <span className="ml-1 text-xs">({(taxRateBp(read, currency) / 100).toFixed(2)}%, applied to every order)</span> : null}
                </label>
                <input
                  id="read-tax"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={read.tax ?? ""}
                  placeholder="0.00"
                  onChange={(e) => update({ tax: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                  className="w-24 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
                />
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span>Total (computed)</span>
                <span className="font-medium tabular-nums">{formatMoney(computedTotalMinor(read, currency) + taxMinorOf(read, currency), currency)}</span>
              </div>
            </>
          ) : intent === "shop" ? (
            // A menu has no total: each customer builds their own cart, so tax is a rate applied at checkout.
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="read-tax-rate" className="text-muted-foreground">
                Sales tax <span className="text-xs">(added to each customer&apos;s order)</span>
              </label>
              <span className="flex items-center gap-1">
                <input
                  id="read-tax-rate"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="50"
                  value={read.taxRate ?? ""}
                  placeholder="0"
                  onChange={(e) => update({ taxRate: e.target.value === "" ? undefined : Math.min(50, Math.max(0, Number(e.target.value))) })}
                  className="w-20 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
                />
                <span className="text-muted-foreground">%</span>
              </span>
            </div>
          ) : null}
          {math && !math.ok ? (
            <p className="mt-2 text-warning-ink">
              The paper says <span className="underline decoration-danger decoration-wavy">{formatMoney(math.written, currency)}</span>, but the lines{taxMinorOf(read, currency) > 0 ? " and tax" : ""} add up to{" "}
              {formatMoney(math.computed, currency)}. I&apos;ll use {formatMoney(math.computed, currency)} unless you change the lines.
            </p>
          ) : math?.ok ? (
            <p className="mt-2 text-success-ink">The written total matches the lines{taxMinorOf(read, currency) > 0 ? " plus tax" : ""}.</p>
          ) : null}
          {read.warnings.map((w) => (
            <p key={w} className="mt-1 text-muted-foreground">
              {w}
            </p>
          ))}
          {draft.aupChecked === false ? <p className="mt-1 text-muted-foreground">Acceptable-use check didn&apos;t run; please make sure your items are allowed.</p> : null}
        </section>
      ) : null}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-background/90 p-3 backdrop-blur">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {intent === "unknown" ? "Pick what to make from this paper." : blocking ? "Fix the highlighted items to continue." : "Looks right? Next you'll review and publish."}
        </p>
        <Button variant="action" size="lg" disabled={blocking || intent === "unknown"} onClick={() => intent !== "unknown" && onContinue(intent)}>
          Continue <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function intervalLabel(read: Read): string {
  const i = read.items.find((x) => x.interval)?.interval;
  return i === "week" ? "WEEKLY" : i === "year" ? "YEARLY" : "MONTHLY";
}
