"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Minus, Plus, ShieldAlert, ShieldCheck, ShoppingBag } from "lucide-react";
import { PayPalButton } from "@/components/paypal/paypal-button";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/core/money";
import { peekStall } from "@/core/peek";
import { taxOn, type StallItem, type StallPayload } from "@/core/stall";
import { api, ApiCallError } from "@/lib/api-client";
import { itemArtKey, useStore } from "@/lib/store";
import { saveBuyerReceipt } from "@/lib/buyer-receipts";
import { kaching } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Concierge } from "./concierge";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function Storefront() {
  const signed = useSyncExternalStore(subscribeHash, () => decodeURIComponent(window.location.hash.slice(1)), () => "");
  const stall = useMemo(() => (signed ? peekStall(signed) : null), [signed]);
  const [check, setCheck] = useState<{ ok: boolean; reason?: string } | null>(null);

  useEffect(() => {
    if (!signed || !stall) return;
    let alive = true;
    api<{ ok: boolean; reason?: string }>("/api/v1/stalls/check", { body: { signed } })
      .then((r) => alive && setCheck(r))
      .catch(() => alive && setCheck({ ok: true })); // the server re-checks at checkout anyway
    return () => {
      alive = false;
    };
  }, [signed, stall]);

  if (!signed) return <Empty title="No stall here" body="Open the link or scan the QR code the seller shared." />;
  if (!stall) return <Empty title="This link is broken" body="Part of the stall link is missing. Ask the seller to share it again." />;
  return <Shop stall={stall} signed={signed} check={check} />;
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md space-y-2 px-4 py-20 text-center">
      <h1 className="font-serif text-3xl text-ink">{title}</h1>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}

function ItemThumb({ stallId, item }: { stallId: string; item: StallItem }) {
  const local = useStore((s) => s.art[itemArtKey(stallId, item)]);
  const src = item.img ?? local;
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- seller's own crop (data URL) or a market photo
  return <img src={src} alt="" className="size-14 shrink-0 rounded-lg border bg-white object-contain" />;
}

function Shop({ stall, signed, check }: { stall: StallPayload; signed: string; check: { ok: boolean; reason?: string } | null }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const ink = stall.t ?? "#003087";
  const isSeller = useStore((s) => s.stalls.some((x) => x.id === stall.id));
  const addLedger = useStore((s) => s.addLedger);
  const sound = useStore((s) => s.settings.sound);

  const lines = stall.i.filter((i) => (cart[i.id] ?? 0) > 0).map((i) => ({ item: i, qty: cart[i.id] }));
  const subtotal = lines.reduce((n, l) => n + l.item.price * l.qty, 0);
  const tax = taxOn(subtotal, stall.r);
  const total = subtotal + tax;
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const blocked = check && !check.ok;
  const set = (id: string, qty: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(99, qty)) }));

  async function capture(orderId: string) {
    setPaying(true);
    try {
      const res = await api<{
        orderId: string;
        captureId: string;
        totalMinor: number;
        currency: string;
        items: { id: string; name: string; quantity: number }[];
        paidAt?: string;
        stallName: string;
        receiptCode: string;
        pickupCode?: string;
      }>("/api/v1/orders/capture", { body: { signed, orderId } });
      saveBuyerReceipt({ ...res, stallId: stall.id, at: res.paidAt ?? new Date().toISOString() });
      // Counter mode: when checkout happens on the seller's own device, PayPal already confirmed it.
      if (isSeller) {
        addLedger({
          id: res.orderId,
          kind: "order",
          stallId: stall.id,
          at: res.paidAt ?? new Date().toISOString(),
          items: res.items.map((i) => ({ name: i.name, quantity: i.quantity })),
          currency: res.currency,
          totalMinor: res.totalMinor,
          status: "COMPLETED",
          captureId: res.captureId,
          verifiedVia: "counter",
        });
      }
      if (sound) kaching();
      router.push(`/receipt/${res.orderId}`);
    } catch (e) {
      setError(e instanceof ApiCallError ? `${e.error.message}${e.error.debugId ? ` (debug_id ${e.error.debugId})` : ""}` : "The payment couldn't be confirmed. You haven't been charged twice; try again.");
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-40" style={{ "--stall-ink": ink } as React.CSSProperties}>
      <header className="mb-8 space-y-2">
        <p className="font-hand text-2xl text-(--stall-ink) dark:text-sky">
          {stall.k ?? "welcome"}
        </p>
        <h1 className="text-5xl leading-[1] font-extrabold tracking-[-0.04em] text-(--stall-ink) sm:text-6xl dark:text-foreground">
          {stall.n}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>Prices in {stall.c}. Pay with PayPal.</span>
          {check?.ok ? (
            <span className="inline-flex items-center gap-1 font-medium text-success-ink">
              <ShieldCheck className="size-4" /> Prices sealed by the seller
            </span>
          ) : null}
        </p>
      </header>

      {blocked ? (
        <div role="alert" className="mb-6 flex gap-3 rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger-ink">
          <ShieldAlert className="size-5 shrink-0" />
          <p>
            {check.reason === "tampered"
              ? "This stall link was edited after the seller published it, so it can't take payments. Ask the seller for their real link."
              : check.reason === "expired"
                ? "This stall link has expired. Ask the seller for a fresh one."
                : "This stall link isn't valid."}
          </p>
        </div>
      ) : null}

      <Concierge stall={stall} onPropose={(c, n) => {
        setCart(c);
        setNotes(n);
      }} />

      <ul className="mt-6 grid gap-x-10 rounded-2xl border bg-card px-4 py-2 sm:px-6 md:grid-cols-2">
        {stall.i.map((it) => {
          const qty = cart[it.id] ?? 0;
          return (
            <li key={it.id} className={cn("flex items-center gap-3 border-b border-dashed py-4 transition-colors last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0")}>
              <ItemThumb stallId={stall.id} item={it} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="font-semibold leading-tight">{it.name}</span>
                  <span aria-hidden className="mb-1 min-w-4 flex-1 border-b-2 border-dotted border-border" />
                  <span className="font-semibold tabular-nums">
                    {formatMoney(it.price, stall.c)}
                    {it.unit ? <span className="text-xs font-normal text-muted-foreground"> {it.unit}</span> : null}
                  </span>
                </p>
                {it.orig ? <p className="font-hand text-lg leading-tight text-(--stall-ink) dark:text-sky">{it.orig}</p> : null}
                {it.desc ? <p className="mt-0.5 text-xs text-muted-foreground">{it.desc}</p> : null}
                {notes[it.id] ? <p className="mt-1 text-xs text-action">Note: {notes[it.id]}</p> : null}
              </div>
              {qty ? (
                <span className="flex shrink-0 items-center gap-1">
                  <Button size="icon-sm" variant="outline" className="rounded-full" aria-label={`One less ${it.name}`} onClick={() => set(it.id, qty - 1)}>
                    <Minus />
                  </Button>
                  <span className="w-5 text-center font-semibold tabular-nums" aria-live="polite">
                    {qty}
                  </span>
                  <Button size="icon-sm" variant="outline" className="rounded-full" aria-label={`One more ${it.name}`} onClick={() => set(it.id, qty + 1)}>
                    <Plus />
                  </Button>
                </span>
              ) : (
                <Button size="icon-sm" variant="outline" className="shrink-0 rounded-full" onClick={() => set(it.id, 1)} aria-label={`Add ${it.name}`}>
                  <Plus />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-ink" />
            <span className="text-sm text-muted-foreground">{count ? `${count} item${count > 1 ? "s" : ""}` : "Your cart is empty"}</span>
            <span className="ml-auto text-right sm:ml-3">
              <span className="block text-2xl font-bold tracking-tight tabular-nums">{formatMoney(total, stall.c)}</span>
              {tax > 0 ? <span className="block text-xs text-muted-foreground tabular-nums">incl. {formatMoney(tax, stall.c)} tax</span> : null}
            </span>
          </div>
          <div className="w-full sm:ml-auto sm:w-72">
            {error ? (
              <p role="alert" className="mb-2 text-sm text-danger-ink">
                {error}
              </p>
            ) : null}
            {paying ? (
              <p aria-live="polite" className="text-sm">
                Confirming with PayPal…
              </p>
            ) : (
              <PayPalButton
                kind="order"
                currency={stall.c}
                disabled={!count || Boolean(blocked)}
                onError={setError}
                createOrder={async () => {
                  setError(null);
                  const cartLines = lines.map((l) => ({ id: l.item.id, qty: l.qty }));
                  return api<{ orderId: string }>("/api/v1/orders", { body: { signed, cart: cartLines, notes } });
                }}
                onApprove={capture}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
