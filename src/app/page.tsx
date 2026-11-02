import Link from "next/link";
import { ArrowRight, BookOpenCheck, FileSignature, QrCode, ScanLine, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaperSwitcher } from "@/components/landing/paper-switcher";
import { PaperToPaid } from "@/components/landing/paper-to-paid";
import { ScreenshotCheck } from "@/components/landing/screenshot-check";

// How a sale gets from "paid" to "counted". A real sequence, so it's numbered.
const TRAIL = [
  { icon: FileSignature, title: "Prices are sealed", body: "Publishing signs your price list. Edit a price in the link and checkout refuses it." },
  { icon: ShoppingBag, title: "The customer pays", body: "PayPal Checkout takes the money. Paperstall never sees a card number." },
  { icon: QrCode, title: "They get a receipt", body: "The receipt page carries a QR code with the PayPal order ID." },
  { icon: ScanLine, title: "You scan it", body: "Paperstall asks PayPal directly: was this order paid, how much, and to you?" },
  { icon: BookOpenCheck, title: "It counts", body: "Only a confirmed payment lands in your ledger, once. A replayed receipt is caught." },
];

export default function Home() {
  const sandbox = (process.env.PAYPAL_ENV ?? "sandbox") === "sandbox";
  const buyerEmail = process.env.NEXT_PUBLIC_SANDBOX_BUYER_EMAIL;
  const buyerPassword = process.env.NEXT_PUBLIC_SANDBOX_BUYER_PASSWORD;

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero: the whole idea, played on a real sample. */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8 lg:pb-24">
        <div className="space-y-6">
          <p className="font-hand text-2xl text-action">for Maria, and anyone who sells on paper</p>
          <h1 className="text-[2.75rem] leading-[1] font-extrabold tracking-[-0.045em] text-ink sm:text-6xl lg:text-[4.25rem]">
            Your price list is already a shop.
          </h1>
          <p className="max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
            Photograph the chalkboard, the handwritten bill or the lessons notice. Paperstall reads it, sets up the right way to get paid with PayPal, and
            checks every payment with PayPal before you hand anything over.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="action" size="lg" className="h-11 rounded-full px-5 text-base" asChild>
              <Link href="/new">
                Start with a photo <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-11 rounded-full px-5 text-base" asChild>
              <Link href="/new?mode=samples">Try a sample</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">No account, no app to install. Runs on the PayPal sandbox, so no real money moves.</p>
        </div>
        <PaperToPaid />
      </section>

      {/* The problem */}
      <section aria-labelledby="problem" className="border-y bg-card/60">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
          <div className="space-y-4">
            <h2 id="problem" className="font-serif text-4xl leading-[1.05] text-ink sm:text-5xl">
              A screenshot is not a payment.
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              At a busy stall the customer flashes a phone and walks off with the food. A payment screenshot takes a minute to fake, and the seller finds out
              at the end of the day.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Every Paperstall receipt has a QR code. Scanning it asks PayPal itself whether the money arrived. One of these two screenshots is forged. Can you spot it before you check?
            </p>
          </div>
          <ScreenshotCheck />
        </div>
      </section>

      {/* Any paper */}
      <section aria-labelledby="any-paper" className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
        <div className="mb-8 max-w-2xl space-y-3">
          <h2 id="any-paper" className="font-serif text-4xl leading-[1.05] text-ink sm:text-5xl">
            Different paper, different way to get paid.
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            A menu needs a shop. A bill for one customer needs an invoice. “$120 a month” needs a subscription. The Read works out which one from the paper
            itself, and you check it before anything goes live.
          </p>
        </div>
        <PaperSwitcher />
      </section>

      {/* How a sale is checked */}
      <section aria-labelledby="trail" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:pb-24">
        <h2 id="trail" className="font-serif text-3xl text-ink sm:text-4xl">
          From “paid” to counted
        </h2>
        <ol className="relative mt-8 grid gap-6 md:grid-cols-5 md:gap-4">
          {/* A dashed ink thread joins the steps. */}
          <svg aria-hidden className="absolute top-4 left-5 hidden h-2 w-[80%] md:block" preserveAspectRatio="none" viewBox="0 0 100 2">
            <line x1="0" y1="1" x2="100" y2="1" stroke="var(--action)" strokeWidth="2" strokeDasharray="1.2 1.6" vectorEffect="non-scaling-stroke" />
          </svg>
          {TRAIL.map((t, i) => (
            <li key={t.title} className="relative flex gap-4 md:flex-col md:gap-3">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-background text-ink">
                <t.icon className="size-[18px]" />
              </span>
              <div>
                <p className="font-semibold">
                  <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}</span>
                  {t.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {sandbox ? (
        <section aria-labelledby="judge" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:pb-24">
          <div className="grid gap-6 rounded-2xl border-2 border-dashed border-ink/30 bg-card p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-3">
              <h2 id="judge" className="font-serif text-3xl text-ink">
                Judging? Here’s the four-minute path.
              </h2>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                <li>
                  <Link className="font-medium text-action underline underline-offset-2" href="/new?mode=samples">
                    Pick a sample
                  </Link>{" "}
                  or photograph any price list.
                </li>
                <li>Watch the Read circle each item, then publish the stall.</li>
                <li>Open it as a buyer, add items and pay with the sandbox buyer.</li>
                <li>
                  Scan the receipt on{" "}
                  <Link className="font-medium text-action underline underline-offset-2" href="/verify">
                    Check a payment
                  </Link>{" "}
                  and see the sale land in the ledger.
                </li>
              </ol>
            </div>
            {buyerEmail ? (
              <dl className="h-fit self-center rounded-xl bg-muted px-5 py-4 text-sm">
                <dt className="text-muted-foreground">Sandbox buyer</dt>
                <dd className="font-mono">{buyerEmail}</dd>
                {buyerPassword ? (
                  <>
                    <dt className="mt-2 text-muted-foreground">Password</dt>
                    <dd className="font-mono">{buyerPassword}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Closing: the chalkboard itself */}
      <section className="bg-slate text-[#ece9df]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20">
          <p className="max-w-xl font-hand text-4xl leading-tight text-chalk sm:text-5xl">Grab the chalkboard. You’ll be selling in about a minute.</p>
          <Button size="lg" className="h-11 shrink-0 rounded-full bg-[#ece9df] px-5 text-base text-slate hover:bg-white" asChild>
            <Link href="/new">
              Start with a photo <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
      <footer className="bg-slate text-[#ece9df]/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-6 gap-y-2 border-t border-white/10 px-4 py-6 text-sm">
          <Link href="/verify" className="hover:text-white">
            Check a payment
          </Link>
          <Link href="/studio" className="hover:text-white">
            My stalls
          </Link>
          <Link href="/docs/api" className="hover:text-white">
            API
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <span className="ml-auto">Built for the PayPal AI Hackathon</span>
        </div>
      </footer>
    </div>
  );
}
