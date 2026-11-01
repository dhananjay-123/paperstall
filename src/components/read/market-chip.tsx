"use client";

import { Drawer } from "vaul";
import { ExternalLink, Store } from "lucide-react";
import type { MarketMatch } from "@/core/market";
import { Button } from "@/components/ui/button";
import { formatMoney, toMinor, isPayPalCurrency } from "@/core/money";

const money = (n: number, c: string) => formatMoney(isPayPalCurrency(c) ? toMinor(n, c) : Math.round(n * 100), c);

export function MarketChip({
  match,
  usePhoto,
  onUsePhoto,
  onUsePrice,
}: {
  match: MarketMatch;
  usePhoto: boolean;
  onUsePhoto: (v: boolean) => void;
  onUsePrice: (n: number) => void;
}) {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-sky/50 bg-sky/10 px-2 py-0.5 text-xs text-ink outline-none hover:bg-sky/20 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Store className="size-3" />
          Market: {money(match.min, match.currency)}–{money(match.max, match.currency)} · {match.stores} stores
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-lg overflow-y-auto rounded-t-2xl border bg-background p-5 outline-none">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
          <Drawer.Title className="font-serif text-2xl text-ink">{match.title}</Drawer.Title>
          <Drawer.Description className="text-sm text-muted-foreground">
            {match.brand ? `${match.brand} · ` : ""}Matched with {Math.round(match.confidence * 100)}% confidence · prices in {match.currency}
          </Drawer.Description>
          <ul className="mt-4 divide-y rounded-lg border bg-card text-sm">
            {match.offers.map((o) => (
              <li key={o.url} className="flex items-center justify-between gap-3 p-2.5">
                <span className="truncate">{o.retailer}</span>
                <span className="flex items-center gap-3">
                  <span className={o.inStock ? "" : "text-muted-foreground line-through"}>{money(o.price, match.currency)}</span>
                  <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="text-action" aria-label={`Open ${o.retailer}`}>
                    <ExternalLink className="size-4" />
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg bg-accent p-3 text-sm">
            <p>
              Suggested: <strong>{money(match.suggested, match.currency)}</strong>
            </p>
            <p className="text-muted-foreground">
              A little under the median of {match.stores} stores ({money(match.median, match.currency)}), since buyers can take it home today.
            </p>
            <Drawer.Close asChild>
              <Button size="sm" variant="action" className="mt-2" onClick={() => onUsePrice(match.suggested)}>
                Use suggested price
              </Button>
            </Drawer.Close>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--action)]" checked={usePhoto} onChange={(e) => onUsePhoto(e.target.checked)} />
            <span>
              Use product photo &amp; specs
              <span className="block text-muted-foreground">By default buyers see your own handwriting.</span>
            </span>
          </label>
          <p className="mt-4 text-xs text-muted-foreground">Market data from Channel3, checked {new Date(match.checkedAt).toLocaleString()}.</p>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
