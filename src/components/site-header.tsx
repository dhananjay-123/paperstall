import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="group flex items-baseline gap-1.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="font-serif text-2xl leading-none text-ink">Paperstall</span>
          <span className="font-hand text-lg leading-none text-action">get paid</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/new"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            New
          </Link>
          <Link
            href="/studio"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            My stalls
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
