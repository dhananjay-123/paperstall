import Link from "next/link";
import { Button } from "@/components/ui/button";

/** An empty chalkboard waiting for prices: the empty state for anything that needs a stall first. */
export function EmptyBoard({ title, body, action, href }: { title: string; body: string; action: string; href: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
      <svg viewBox="0 0 200 150" aria-hidden className="w-48">
        <rect x="14" y="10" width="172" height="124" rx="6" fill="#6b4a2b" transform="rotate(-2 100 72)" />
        <rect x="24" y="19" width="152" height="106" rx="3" fill="var(--slate)" transform="rotate(-2 100 72)" />
        <g transform="rotate(-2 100 72)" stroke="var(--chalk)" strokeLinecap="round" fill="none" opacity="0.9">
          <path d="M60 40 h80" strokeWidth="3" />
          <path d="M42 62 h64 M128 62 h20 M42 80 h52 M128 80 h20 M42 98 h70 M128 98 h20" strokeWidth="2" strokeDasharray="2 6" opacity="0.55" />
        </g>
        <path d="M150 128 l20 14" stroke="#d9cfb8" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <h1 className="mt-6 font-serif text-3xl text-ink">{title}</h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
      <Button variant="action" size="lg" className="mt-5 h-10 rounded-full px-5" asChild>
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}
