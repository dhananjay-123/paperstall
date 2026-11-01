import Link from "next/link";
import { ArrowRight, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

const RAILS = [
  { title: "A list of things to sell", rail: "Storefront with PayPal Checkout", hand: "Latte $4 · Croissant $3" },
  { title: "A bill for one customer", rail: "PayPal Invoice with a QR code", hand: "200 cards × $0.20" },
  { title: "Something every month", rail: "PayPal Subscription plan", hand: "Piano lessons $120/month" },
];

export default function Home() {
  const sandbox = (process.env.PAYPAL_ENV ?? "sandbox") === "sandbox";
  const buyerEmail = process.env.NEXT_PUBLIC_SANDBOX_BUYER_EMAIL;
  const buyerPassword = process.env.NEXT_PUBLIC_SANDBOX_BUYER_PASSWORD;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 py-14 sm:py-20">
      <section className="max-w-3xl space-y-6">
        <p className="font-hand text-2xl text-action">for anyone who sells on paper</p>
        <h1 className="font-serif text-5xl leading-[1.05] text-ink sm:text-7xl">
          Draw it. Snap it. <em>Get paid.</em>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Photograph a chalkboard menu, a handwritten bill or a lessons notice. Paperstall reads what it means and gives you a real way to get paid with PayPal,
          then verifies every sale with PayPal before it counts.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="action" size="lg" asChild>
            <Link href="/new">
              Start with a photo <ArrowRight />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/studio">My stalls</Link>
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <Link href="/verify">
              <ScanLine /> Scan to confirm payment
            </Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="rails" className="space-y-4">
        <h2 id="rails" className="font-serif text-3xl text-ink">
          The AI picks the right PayPal product
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

      {sandbox ? (
        <section aria-labelledby="judge" className="space-y-3 rounded-2xl border-2 border-dashed border-action/50 bg-card p-6">
          <h2 id="judge" className="font-serif text-3xl text-ink">
            Judge quick path
          </h2>
          <p className="text-sm text-muted-foreground">Everything runs on the PayPal sandbox. No real money moves.</p>
          {buyerEmail ? (
            <dl className="grid w-fit grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted px-4 py-3 font-mono text-sm">
              <dt className="text-muted-foreground">Sandbox buyer</dt>
              <dd>{buyerEmail}</dd>
              {buyerPassword ? (
                <>
                  <dt className="text-muted-foreground">Password</dt>
                  <dd>{buyerPassword}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              <Link className="text-action underline" href="/new">
                Start
              </Link>{" "}
              → photo, upload or draw a price list (or pick a sample).
            </li>
            <li>Watch the Read circle each item, then Continue → Publish stall.</li>
            <li>Open as a buyer, add items, pay with the sandbox buyer above.</li>
            <li>Back in the studio, Scan to confirm payment (or type the order ID) to see PayPal verify it.</li>
          </ol>
        </section>
      ) : null}
    </div>
  );
}
