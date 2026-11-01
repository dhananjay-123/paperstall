"use client";

import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

/** Gemini-style normalized box: [ymin, xmin, ymax, xmax], each 0–1000. */
export type Box = readonly [number, number, number, number];

// Small deterministic PRNG so a given item always gets the same hand-drawn wobble
// (no hydration mismatch, no jitter on re-render).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Path around a normalized box, in pixels of a `width`×`height` container.
 * Drawn in real pixels with a computed length: some Chromium builds ignore `pathLength`
 * for dash arrays, which turns the draw-on animation into dotted lines.
 */
export function inkCirclePath(box: Box, seed = 1, width = 1000, height = 1000): { d: string; length: number } {
  const [ymin, xmin, ymax, xmax] = box;
  const sx = width / 1000;
  const sy = height / 1000;
  const rand = mulberry32(seed);
  const cx = ((xmin + xmax) / 2) * sx;
  const cy = ((ymin + ymax) / 2) * sy;
  // Pad so the stroke sits around the text rather than through it.
  const rx = ((xmax - xmin) / 2) * sx + 12;
  const ry = ((ymax - ymin) / 2) * sy + 8;
  const start = -Math.PI / 2 - 0.5 + rand() * 0.4;
  // A hand overshoots: go a little past a full turn.
  const sweep = Math.PI * 2 + 0.35 + rand() * 0.25;
  const steps = 56;
  const points: string[] = [];
  let length = 0;
  let px = 0;
  let py = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + sweep * t;
    // Radius drifts slowly so the end doesn't meet the start exactly.
    const drift = 1 + (t - 0.5) * 0.08 + (rand() - 0.5) * 0.025;
    const x = cx + Math.cos(a) * rx * drift;
    const y = cy + Math.sin(a) * ry * drift;
    if (i > 0) length += Math.hypot(x - px, y - py);
    px = x;
    py = y;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return { d: points.join(" "), length: Math.ceil(length) };
}

type InkCircleProps = {
  box: Box;
  seed?: number;
  delay?: number;
  color?: string;
  /** Replays the draw animation when this changes. */
  playKey?: number;
};

/** An ink stroke that draws itself around a 0–1000 normalized box. Place inside a `relative` parent. */
export function InkCircle({ box, seed = 1, delay = 0, color = "var(--action)", playKey = 0 }: InkCircleProps) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const path = useMemo(() => (size ? inkCirclePath(box, seed, size.w, size.h) : null), [box, seed, size]);

  return (
    <svg ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {path ? (
        <motion.path
          key={playKey}
          d={path.d}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={path.length}
          initial={reduce ? false : { strokeDashoffset: path.length, opacity: 0.2 }}
          animate={{ strokeDashoffset: 0, opacity: 0.9 }}
          transition={{ duration: 0.7, delay, ease: [0.65, 0, 0.35, 1] }}
        />
      ) : null}
    </svg>
  );
}
