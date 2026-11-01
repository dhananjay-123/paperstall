import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const RAILS = [
  { title: "A list of things to sell", rail: "Storefront with PayPal Checkout", hand: "Latte $4 · Croissant $3" },
  { title: "A bill for one customer", rail: "PayPal Invoice with a QR code", hand: "200 cards × $0.20" },
  { title: "Something every month", rail: "PayPal Subscription plan", hand: "Piano lessons $120/month" },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 py-14 sm:py-20">
      <section className="max-w-3xl space-y-6">
        <p className="font-hand text-2xl text-action">for anyone who sells on paper</p>
        <h1 className="font-serif text-5xl leading-[1.05] text-ink sm:text-7xl">
          Draw it. Snap it. <em>Get paid.</em>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Photograph a chalkboard menu, a handwritten bill or a lessons notice. Paperstall reads what it means and
          gives you a real way to get paid with PayPal.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="action" size="lg" disabled title="Capture arrives in Phase 2">
            Start with a photo <ArrowRight />
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/design">See the design system</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="rails" className="space-y-4">
        <h2 id="rails" className="sr-only">
          What Paperstall makes from your paper
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {RAILS.map((r) => (
            <div key={r.title} className="rounded-xl border bg-card p-5">
              <p className="font-hand text-2xl text-action">{r.hand}</p>
              <p className="mt-3 font-medium">{r.title}</p>
              <p className="text-sm text-muted-foreground">→ {r.rail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
