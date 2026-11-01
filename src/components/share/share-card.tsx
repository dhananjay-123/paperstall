"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Printer, Share2 } from "lucide-react";
import { Qr } from "@/components/share/qr";
import { Button } from "@/components/ui/button";

const noop = () => () => {};

export function stallUrl(origin: string, signed: string) {
  return `${origin}/s#${signed}`;
}

export function ShareCard({ stallId, signed, name }: { stallId: string; signed: string; name: string }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = origin ? stallUrl(origin, signed) : "";
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

  return (
    <section aria-labelledby="share-h" className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-[auto_1fr]">
      <div className="flex justify-center">{url ? <Qr value={url} size={180} label={`QR code for ${name}`} className="rounded-lg" /> : <div className="size-[180px] rounded-lg ink-shimmer" />}</div>
      <div className="min-w-0 space-y-3">
        <h2 id="share-h" className="font-serif text-2xl text-ink">
          Share your stall
        </h2>
        <p className="text-sm text-muted-foreground">Buyers scan the QR or open the link, pick items and pay with PayPal.</p>
        <p className="truncate rounded-md bg-muted px-2 py-1 font-mono text-xs" title={url}>
          {url || "…"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
          </Button>
          {canShare ? (
            <Button size="sm" variant="outline" onClick={() => void navigator.share({ title: name, url }).catch(() => {})}>
              <Share2 /> Share
            </Button>
          ) : null}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/studio/${stallId}/poster`}>
              <Printer /> Print “Scan to pay” poster
            </Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={url} target="_blank" rel="noopener">
              Open as a buyer
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
