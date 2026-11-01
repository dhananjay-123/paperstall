"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InkCircle, type Box } from "@/components/ink/ink-circle";
import { Stamp, type StampKind } from "@/components/ink/stamp";

// Hand-placed lines on a demo chalkboard, with boxes in the same 0–1000 space Gemini uses.
const LINES: { text: string; box: Box }[] = [
  { text: "Latte  $4", box: [250, 120, 360, 560] },
  { text: "Croissant  $3", box: [430, 120, 540, 700] },
  { text: "Cold brew  $5", box: [610, 120, 720, 680] },
];

const STAMPS: StampKind[] = ["shop", "invoice", "monthly", "paid", "unknown"];

export function InkDemo() {
  const [play, setPlay] = useState(0);

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
      <div className="space-y-3">
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-xl border-8 border-[#5a3d22] bg-[#1f2a24] shadow-inner"
          aria-label="Demo chalkboard with three items circled in ink"
          role="img"
        >
          <p className="absolute top-[7%] left-[12%] font-hand text-3xl text-white/80">Rosa&apos;s Coffee Cart</p>
          {LINES.map((l) => (
            <p
              key={l.text}
              className="absolute flex items-center font-hand text-2xl whitespace-pre text-white/90 sm:text-3xl"
              style={{
                top: `${l.box[0] / 10}%`,
                left: `${l.box[1] / 10}%`,
                height: `${(l.box[2] - l.box[0]) / 10}%`,
              }}
            >
              {l.text}
            </p>
          ))}
          {LINES.map((l, i) => (
            <InkCircle key={l.text} box={l.box} seed={i + 7} delay={0.25 + i * 0.35} color="#4cc3f0" playKey={play} />
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setPlay((p) => p + 1)}>
          <RotateCcw /> Replay the Read
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-6">
          {STAMPS.map((k, i) => (
            <Stamp key={k} kind={k} playKey={play} rotate={i % 2 ? 4 : -6} />
          ))}
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <Stamp kind="shop" playKey={play} />
            <p className="text-sm text-muted-foreground">
              Found 3 items with prices and no customer name → storefront.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
