"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Minus, Plus, ShieldAlert, ShoppingBag } from "lucide-react";
import { PayPalButton } from "@/components/paypal/paypal-button";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/core/money";
import { peekStall } from "@/core/peek";
import type { StallItem, StallPayload } from "@/core/stall";
import { api, ApiCallError } from "@/lib/api-client";
import { itemArtKey, useStore } from "@/lib/store";
import { saveBuyerReceipt } from "@/lib/buyer-receipts";
import { kaching } from "@/lib/sound";
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

function ItemArt({ stallId, item, ink }: { stallId: string; item: StallItem; ink: string }) {
  const local = useStore((s) => s.art[itemArtKey(stallId, item)]);
  const src = item.img ?? local;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- seller's own crop (data URL) or a market photo
    return <img src={src} alt={item.name} className="h-24 w-full rounded-lg bg-white object-contain" />;
  }
  // Buyers on other devices don't have the crop: show the name as an ink label, never a broken image.
  return (
    <div className="flex h-24 w-full items-center justify-center rounded-lg bg-white px-3 text-center font-hand text-3xl leading-none" style={{ color: ink }} aria-hidden>
      {item.orig ?? item.name}
    </div>
  );
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
  const total = lines.reduce((n, l) => n + l.item.price * l.qty, 0);
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
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-40">
      <header className="mb-6 space-y-1">
        <p className="font-hand text-2xl" style={{ color: ink }}>
          {stall.k ?? "welcome"}
        </p>
        <h1 className="font-serif text-5xl leading-tight" style={{ color: ink }}>
          {stall.n}
        </h1>
        <p className="text-sm text-muted-foreground">Prices in {stall.c}. Pay securely with PayPal.</p>
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

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stall.i.map((it) => {
          const qty = cart[it.id] ?? 0;
          return (
            <li key={it.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
              <ItemArt stallId={stall.id} item={it} ink={ink} />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-tight">{it.name}</p>
                {it.orig ? <p className="font-hand text-lg leading-none text-muted-foreground">{it.orig}</p> : null}
                {it.desc ? <p className="mt-1 text-xs text-muted-foreground">{it.desc}</p> : null}
                {notes[it.id] ? <p className="mt-1 text-xs text-action">Note: {notes[it.id]}</p> : null}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium tabular-nums">
                  {formatMoney(it.price, stall.c)}
                  {it.unit ? <span className="text-xs text-muted-foreground"> {it.unit}</span> : null}
                </span>
                {qty ? (
                  <span className="flex items-center gap-1">
                    <Button size="icon-sm" variant="outline" aria-label={`One less ${it.name}`} onClick={() => set(it.id, qty - 1)}>
                      <Minus />
                    </Button>
                    <span className="w-5 text-center tabular-nums" aria-live="polite">
                      {qty}
                    </span>
                    <Button size="icon-sm" variant="outline" aria-label={`One more ${it.name}`} onClick={() => set(it.id, qty + 1)}>
                      <Plus />
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => set(it.id, 1)} aria-label={`Add ${it.name}`}>
                    <Plus /> Add
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-ink" />
            <span className="text-sm text-muted-foreground">{count ? `${count} item${count > 1 ? "s" : ""}` : "Your cart is empty"}</span>
            <span className="ml-auto font-serif text-2xl tabular-nums sm:ml-3">{formatMoney(total, stall.c)}</span>
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
