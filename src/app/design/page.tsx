import type { Metadata } from "next";
import { ArrowRight, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InkDemo } from "./ink-demo";

export const metadata: Metadata = { title: "Design system" };

const SWATCHES = [
  { name: "Paper", token: "paper", hex: "#F7F4EC", className: "bg-[#F7F4EC] border" },
  { name: "Card", token: "card", hex: "#FFFFFF", className: "bg-white border" },
  { name: "Ink / navy", token: "ink", hex: "#003087", className: "bg-[#003087]" },
  { name: "PayPal blue", token: "action", hex: "#0070E0", className: "bg-action" },
  { name: "Sky", token: "sky", hex: "#009CDE", className: "bg-[#009CDE]" },
  { name: "Graphite", token: "graphite", hex: "#1B1B1F", className: "bg-[#1B1B1F]" },
  { name: "Success", token: "success", hex: "#0A8F5C", className: "bg-[#0A8F5C]" },
  { name: "Warning", token: "warning", hex: "#C77700", className: "bg-[#C77700]" },
  { name: "Danger", token: "danger", hex: "#C4302B", className: "bg-[#C4302B]" },
  { name: "Blueprint", token: "dark paper", hex: "#0B1530", className: "bg-[#0B1530]" },
];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-3xl text-ink">{title}</h2>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-10">
      <header className="space-y-2">
        <p className="font-hand text-xl text-action">design system</p>
        <h1 className="font-serif text-5xl leading-tight text-ink sm:text-6xl">Ink &amp; Ledger</h1>
        <p className="max-w-2xl text-muted-foreground">
          Paper meets PayPal: warm off-white, real ink, precise blue. Toggle the theme in the header to see
          blueprint mode.
        </p>
      </header>

      <Section title="Colour" note="Status colours have darker *-ink variants for small text, to pass WCAG AA.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SWATCHES.map((s) => (
            <div key={s.name} className="overflow-hidden rounded-lg border bg-card">
              <div className={`h-16 ${s.className}`} />
              <div className="p-2.5 text-xs">
                <p className="font-medium">{s.name}</p>
                <p className="font-mono text-muted-foreground">
                  {s.hex} · {s.token}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-medium">
          <span className="text-success-ink">Paid · success-ink</span>
          <span className="text-warning-ink">Check the total · warning-ink</span>
          <span className="text-danger-ink">Not paid yet · danger-ink</span>
        </div>
      </Section>

      <Section title="Type" note="Inter for UI · Instrument Serif for headlines · Caveat for ink annotations only.">
        <div className="space-y-3 rounded-xl border bg-card p-6">
          <p className="font-serif text-5xl text-ink">Draw it. Snap it. Get paid.</p>
          <p className="font-serif text-3xl italic">A storefront from a chalkboard.</p>
          <p className="text-base">
            Paperstall reads the paper, picks the right PayPal product and gives you a link to get paid.
          </p>
          <p className="text-sm text-muted-foreground">Small print: every sale is verified with PayPal before it&apos;s recorded.</p>
          <p className="font-hand text-2xl text-action">Latte $4 ← circled in ink</p>
          <p className="font-mono text-xs text-muted-foreground">debug_id f1a2b3c4d5e6</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-6">
          <Button variant="action" size="lg">
            <Camera /> Snap your paper
          </Button>
          <Button size="lg">
            Publish stall <ArrowRight />
          </Button>
          <Button variant="secondary">Edit items</Button>
          <Button variant="outline">Try a sample</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="destructive">Cancel invoice</Button>
          <Button variant="link">Read the docs</Button>
          <Button variant="action" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Ink</Badge>
          <Badge variant="secondary">Draft</Badge>
          <Badge variant="outline">cached</Badge>
          <Badge variant="destructive">Failed</Badge>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl font-normal text-ink">Today&apos;s takings</CardTitle>
              <CardDescription>Verified with PayPal</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-serif text-4xl tabular-nums">$0.00</p>
              <p className="text-xs text-muted-foreground">Example card · no sales yet</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latte</CardTitle>
              <CardDescription className="font-hand text-lg text-action">as written: Latte $4</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="font-medium tabular-nums">$4.00</span>
              <Badge variant="outline">per cup</Badge>
            </CardContent>
            <CardFooter>
              <Button variant="action" className="w-full">
                Add to cart
              </Button>
            </CardFooter>
          </Card>
          <Card aria-busy="true" aria-label="Loading example">
            <CardHeader>
              <CardTitle className="text-base">Ink is drying…</CardTitle>
              <CardDescription>Loading skeleton</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-3/4 rounded ink-shimmer" />
              <div className="h-4 w-1/2 rounded ink-shimmer" />
              <div className="h-4 w-2/3 rounded ink-shimmer" />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        title="Signature moments"
        note="The ink circle draws around each detected box; the stamp shows the chosen rail. Both respect reduced motion."
      >
        <InkDemo />
      </Section>
    </div>
  );
}
