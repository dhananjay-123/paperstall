import type { Metadata } from "next";
import Link from "next/link";
import { API_OPERATIONS } from "@/core/openapi";

export const metadata: Metadata = { title: "API" };

export default function ApiDocsPage() {
  const tags = [...new Set(API_OPERATIONS.map((o) => o.tag))];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="font-hand text-xl text-action">built to integrate</p>
        <h1 className="font-serif text-5xl text-ink">Paperstall API</h1>
        <p className="text-muted-foreground">
          Versioned JSON API under <code className="font-mono">/api/v1</code>. The full OpenAPI 3.1 spec, generated from the same zod schemas the server validates with,
          is at{" "}
          <Link className="text-action underline" href="/api/v1/openapi.json">
            /api/v1/openapi.json
          </Link>
          . Every response includes <code className="font-mono">receipts</code>: the PayPal, Gemini and Channel3 calls it made, with PayPal debug IDs.
        </p>
      </header>
      {tags.map((t) => (
        <section key={t} className="space-y-2">
          <h2 className="font-serif text-2xl text-ink">{t}</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {API_OPERATIONS.filter((o) => o.tag === t).map((o) => (
              <li key={o.path} className="space-y-1 px-4 py-3">
                <p className="font-mono text-sm">
                  <span className="mr-2 rounded bg-ink px-1.5 py-0.5 text-xs text-paper">{o.method}</span>
                  {o.path}
                </p>
                <p className="text-sm">{o.summary}</p>
                {o.description ? <p className="text-sm text-muted-foreground">{o.description}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="font-serif text-2xl text-ink">Errors and limits</h2>
        <p>
          Errors are <code className="font-mono">{"{ error: { code, message, debugId? } }"}</code>. AI and payment routes are rate-limited per IP (best-effort on serverless) and accept
          same-origin browser requests only. Money is always integer minor units; the server recomputes every amount from a signed stall.
        </p>
      </section>
    </div>
  );
}
