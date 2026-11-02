import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="Paperstall home" className="group flex items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/new"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            New
          </Link>
          <Link
            href="/verify"
            className="hidden rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none sm:inline"
          >
            Check a payment
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
