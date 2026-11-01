"use client";

import { getStroke } from "perfect-freehand";
import { Eraser, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Point = [number, number, number];

function pathFromStroke(points: Point[]): string {
  const stroke = getStroke(points, { size: 5, thinning: 0.6, smoothing: 0.5, streamline: 0.5 });
  if (!stroke.length) return "";
  const d = stroke.reduce<(string | number)[]>(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"],
  );
  return `${d.join(" ")} Z`;
}

const W = 800;
const H = 600;

/** A paper to draw a price list on, exported as a PNG for the Read. */
export function DrawPad({ onDone, busy }: { onDone: (dataUrl: string) => void; busy?: boolean }) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[] | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const toPoint = (e: React.PointerEvent): Point => {
    const r = svg.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H, e.pressure || 0.5];
  };

  async function exportPng() {
    const markup = new XMLSerializer().serializeToString(svg.current!);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);
    onDone(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <svg
        ref={svg}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${W} ${H}`}
        className="aspect-[4/3] w-full touch-none rounded-xl border bg-white shadow-inner"
        role="img"
        aria-label="Drawing paper. Write your items and prices here."
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setCurrent([toPoint(e)]);
        }}
        onPointerMove={(e) => {
          if (current && e.buttons) setCurrent([...current, toPoint(e)]);
        }}
        onPointerUp={() => {
          if (current && current.length > 1) setStrokes((s) => [...s, current]);
          setCurrent(null);
        }}
      >
        <rect width={W} height={H} fill="#ffffff" />
        {[...strokes, ...(current ? [current] : [])].map((s, i) => (
          <path key={i} d={pathFromStroke(s)} fill="#003087" />
        ))}
      </svg>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}>
          <Undo2 /> Undo
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStrokes([])} disabled={!strokes.length}>
          <Eraser /> Clear
        </Button>
        <Button variant="action" size="sm" className="ml-auto" onClick={exportPng} disabled={strokes.length < 2 || busy}>
          Read my drawing
        </Button>
      </div>
    </div>
  );
}
