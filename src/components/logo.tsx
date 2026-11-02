import { cn } from "@/lib/utils";

/**
 * The Paperstall mark: a market-stall awning over a price list, circled in ink.
 * Drawn in currentColor, so it is navy on paper and paper-white on the dark theme.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 56" aria-hidden className={cn("shrink-0", className)} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {/* Awning: four panels with scalloped edges */}
      <g fill="currentColor" stroke="none">
        <path d="M13.2 3.2 L22.4 3 L18.6 16.4 Q13.4 19.4 8 16.6 Z" />
        <path d="M24.6 3 L31.4 2.8 L31 16.2 Q25.4 19.3 20.6 16.4 Z" />
        <path d="M33.6 2.8 L40.6 2.7 L44 16 Q38.6 19.2 33.2 16.2 Z" />
        <path d="M42.8 2.7 L50.8 2.6 L57.2 15.6 Q51.6 19 46.2 16 Z" />
      </g>
      {/* Poles */}
      <path d="M11.4 18.6 L14.6 43.6" strokeWidth="2.6" />
      <path d="M53.6 18.2 L52.6 37" strokeWidth="2.6" />
      {/* The ink circle, with a hand's overshoot */}
      <path d="M50.8 31.2 C 58.4 33.6, 57.2 41.6, 44 46.6 C 31.8 51.4, 13.8 53.2, 7.4 48.4 C 1.8 44, 6 37.4, 17.6 33.2 C 27.4 29.6, 42.6 27.6, 52.2 30.4" strokeWidth="2.6" />
      {/* Price lines */}
      <path d="M20 37.4 L38.4 34.6 M20.6 42 L36.8 39.6 M21.2 46.6 L33.6 44.8" strokeWidth="2.8" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark className="h-8 w-auto" />
      <span className="text-[1.35rem] leading-none font-extrabold tracking-[-0.04em]">Paperstall</span>
    </span>
  );
}
