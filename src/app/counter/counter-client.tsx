"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyBoard } from "@/components/empty-board";
import { useStore } from "@/lib/store";
import { Studio } from "../studio/[stallId]/studio";

/** The live counter is the studio's first tab; this route just picks which stall. */
export function CounterClient({ initialStall }: { initialStall?: string }) {
  const stalls = useStore((s) => s.stalls).filter((x) => x.intent === "shop");
  const [picked, setPicked] = useState<string | null>(initialStall ?? (stalls.length === 1 ? stalls[0].id : null));
  const stall = stalls.find((s) => s.id === picked);

  if (!stalls.length) {
    return <EmptyBoard title="No stall on this device yet" body="The live counter shows paid orders for a stall you published here. Make one first." action="Make a stall" href="/new" />;
  }
  if (stall) return <Studio stallId={stall.id} />;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="font-serif text-3xl text-ink">Which stall is this counter for?</h1>
      <ul className="mt-5 divide-y rounded-xl border bg-card">
        {stalls.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => setPicked(s.id)} className="w-full px-4 py-3 text-left font-medium hover:bg-muted">
              {s.payload.n}
              {s.doorbell ? null : <span className="ml-2 text-xs font-normal text-muted-foreground">scan receipts only</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted-foreground">
        Or <Link href="/studio" className="text-action underline underline-offset-2">see all your stalls</Link>.
      </p>
    </div>
  );
}
