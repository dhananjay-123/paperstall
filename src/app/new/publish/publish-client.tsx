"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Box } from "@/components/ink/ink-circle";
import { formatMoney } from "@/core/money";
import { peekStall } from "@/core/peek";
import type { Stall } from "@/core/stall";
import { api, ApiCallError } from "@/lib/api-client";
import { taxRateBp } from "@/core/read/checks";
import { stallItemsFromRead } from "@/lib/from-read";
import { cropBox, downscale } from "@/lib/image";
import { itemArtKey, useStore } from "@/lib/store";
import { effectiveCurrency } from "../read/read-client";
import { InvoicePublish } from "./invoice-publish";
import { PlanPublish } from "./plan-publish";

const elapsedSince = (t: number) => Date.now() - t;

const INKS = ["#003087", "#1b1b1f", "#0a6b4a", "#8a2a1b"];

export function PublishClient({ intent, defaultPayee }: { intent: "shop" | "invoice" | "subscription"; defaultPayee: string }) {
  const draft = useStore((s) => s.draft);
  if (!draft?.read) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-ink">Nothing to publish yet</h1>
        <Button variant="action" asChild>
          <Link href="/new">Snap your paper</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Link href="/new/read" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to the Read
      </Link>
      {intent === "shop" ? <ShopPublish defaultPayee={defaultPayee} /> : intent === "invoice" ? <InvoicePublish /> : <PlanPublish />}
    </div>
  );
}

export function usePayee(defaultPayee: string) {
  const saved = useStore((s) => s.settings.payeeEmail);
  return useState(saved || defaultPayee);
}

function ShopPublish({ defaultPayee }: { defaultPayee: string }) {
  const router = useRouter();
  const draft = useStore((s) => s.draft)!;
  const read = draft.read!;
  const currency = effectiveCurrency(draft)!;
  const { upsertStall, putArt, setSettings, setDraft } = useStore.getState();
  const [name, setName] = useState(read.business.name ?? "");
  const [payee, setPayee] = usePayee(defaultPayee);
  const [ink, setInk] = useState(INKS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = stallItemsFromRead(read, currency, draft.market ?? {}, draft.usePhoto ?? {});

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        n: name.trim().slice(0, 60) || "My stall",
        ...(read.business.kind ? { k: read.business.kind.slice(0, 40) } : {}),
        c: currency,
        p: payee.trim(),
        i: items.map(({ _readId, ...rest }: (typeof items)[number] & { _readId?: string }) => {
          void _readId;
          return rest;
        }),
        t: ink,
        l: read.sourceLanguage.slice(0, 12),
        ...(taxRateBp(read, currency) > 0 ? { r: taxRateBp(read, currency) } : {}),
      };
      // The server picks the stall ID and returns an owner token for this device.
      const { signed, doorbell, id, owner } = await api<{ signed: string; doorbell?: string; id: string; owner: string }>("/api/v1/stalls/sign", { body: { payload } });
      // The seller's own handwriting becomes each item's art (kept on this device).
      for (const it of items as ((typeof items)[number] & { _readId: string })[]) {
        const src = read.items.find((r) => r.id === it._readId);
        if (src && src.box.some((n) => n > 0)) {
          const art = await cropBox(draft.imageDataUrl, src.box as unknown as Box);
          if (art) putArt(itemArtKey(id, it), art);
        }
      }
      const thumb = await downscale(draft.imageDataUrl, 360, 0.6).catch(() => undefined);
      const stall: Stall = {
        id,
        // Keep exactly what the server signed (incl. version and expiry).
        payload: peekStall(signed)!,
        signed,
        createdAt: new Date().toISOString(),
        intent: "shop",
        sourceImage: thumb,
        doorbell,
        owner,
        metrics: { photoToPublishMs: elapsedSince(draft.startedAt), editsPerItem: Number((draft.edits / Math.max(1, items.length)).toFixed(2)) },
      };
      upsertStall(stall);
      setSettings({ payeeEmail: payee.trim() });
      setDraft(null);
      router.push(`/studio/${id}?published=1`);
    } catch (e) {
      setError(e instanceof ApiCallError ? e.error.message : "Couldn't publish. Check your connection and try again.");
      setBusy(false);
    }
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payee.trim());

  return (
    <div className="space-y-6">
      <header>
        <p className="font-hand text-xl text-action">step 3 of 3</p>
        <h1 className="font-serif text-4xl text-ink">Publish your stall</h1>
        <p className="text-muted-foreground">Buyers get a link and a QR code. Payments go straight to your PayPal account.</p>
      </header>
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Stall name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="w-full rounded-lg border bg-background px-3 py-2" placeholder="Rosa's Coffee Cart" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Your PayPal email (where the money goes)</span>
          <input
            type="email"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2"
            aria-invalid={!emailOk}
            placeholder="you@business.com"
          />
          <span className="block text-xs text-muted-foreground">Sandbox: use your sandbox business account email.</span>
        </label>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Ink colour</legend>
          <div className="flex gap-2">
            {INKS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setInk(c)}
                aria-label={`Ink ${c}`}
                aria-pressed={ink === c}
                className="size-8 rounded-full border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{ background: c, borderColor: ink === c ? "var(--action)" : "transparent" }}
              />
            ))}
          </div>
        </fieldset>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {items.map((it) => (
          <li key={it.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <span>
              <span className="font-medium">{it.name}</span>
              {it.orig ? <span className="ml-2 font-hand text-lg text-action">{it.orig}</span> : null}
            </span>
            <span className="tabular-nums">{formatMoney(it.price, currency)}</span>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
      <Button variant="action" size="lg" className="w-full sm:w-auto" disabled={busy || !emailOk || !items.length} onClick={publish}>
        {busy ? <Loader2 className="animate-spin" /> : null} Publish stall
      </Button>
    </div>
  );
}
