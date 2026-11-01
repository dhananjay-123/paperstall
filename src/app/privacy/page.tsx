import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="font-serif text-5xl text-ink">Privacy, in plain words</h1>
      <section className="space-y-2">
        <h2 className="font-serif text-2xl text-ink">What stays on your device</h2>
        <p>Your stalls, sales ledger, invoices list, settings, item pictures and the record of calls (Receipts) are stored in this browser only. Paperstall has no database and no accounts.</p>
      </section>
      <section className="space-y-2">
        <h2 className="font-serif text-2xl text-ink">What goes to Google Gemini</h2>
        <p>The photo or drawing you choose to read, shrunk first, and the text you type to Penny or the stall assistant. Gemini turns them into item lists and answers. We don&apos;t send your name or email with them.</p>
      </section>
      <section className="space-y-2">
        <h2 className="font-serif text-2xl text-ink">What goes to PayPal</h2>
        <p>Order lines and amounts, your PayPal email as the payee, and, for invoices, your customer&apos;s name and email. Buyers pay on PayPal; we never see card details.</p>
      </section>
      <section className="space-y-2">
        <h2 className="font-serif text-2xl text-ink">What goes to Channel3</h2>
        <p>Only the brand and model of branded items (for example “JBL Go 3”), to look up market prices. Nothing about you or your buyers.</p>
      </section>
      <section className="space-y-2">
        <h2 className="font-serif text-2xl text-ink">What we don&apos;t do</h2>
        <p>No analytics or ad trackers. Our server doesn&apos;t log your photos, buyer emails or other personal data.</p>
      </section>
    </article>
  );
}
