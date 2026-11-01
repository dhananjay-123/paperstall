import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HealthClient } from "./health-client";

export const metadata: Metadata = { title: "Plumbing check", robots: { index: false } };

export default function HealthPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const configured = {
    paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    payee: Boolean(process.env.PAYPAL_DEMO_PAYEE_EMAIL),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    signing: (process.env.PAYLOAD_SIGNING_SECRET ?? "").length >= 32,
    channel3: Boolean(process.env.CHANNEL3_API_KEY),
  };
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <header>
        <p className="font-hand text-xl text-action">dev only</p>
        <h1 className="font-serif text-4xl text-ink">Plumbing check</h1>
        <p className="text-sm text-muted-foreground">Real sandbox calls. Every call&apos;s PayPal debug ID is listed below.</p>
      </header>
      <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {Object.entries(configured).map(([k, v]) => (
          <li key={k} className="rounded-lg border bg-card px-3 py-2">
            <span className={v ? "text-success-ink" : "text-danger-ink"}>{v ? "●" : "○"}</span> {k}
          </li>
        ))}
      </ul>
      <HealthClient />
    </div>
  );
}
