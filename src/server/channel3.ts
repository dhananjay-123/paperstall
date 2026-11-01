import "server-only";
import { bestMatch, type C3Product, type MarketMatch } from "@/core/market";
import type { ReceiptBook } from "@/core/receipts";

const URL_SEARCH = "https://api.trychannel3.com/v1/search";

export function channel3Configured() {
  return Boolean(process.env.CHANNEL3_API_KEY);
}

async function search(query: string, receipts: ReceiptBook): Promise<C3Product[]> {
  const key = process.env.CHANNEL3_API_KEY;
  if (!key) return [];
  const started = Date.now();
  let status = 0;
  try {
    const res = await fetch(URL_SEARCH, {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    status = res.status;
    if (!res.ok) return [];
    const body = (await res.json()) as { products?: C3Product[] };
    return body.products ?? [];
  } catch {
    return [];
  } finally {
    receipts.add({ service: "channel3", method: "POST", path: "/v1/search", status, ok: status >= 200 && status < 300, ms: Date.now() - started, note: "market check" });
  }
}

/** Parallel, capped, time-boxed. Low-confidence or failed lookups simply return null. */
export async function marketCheck(queries: { id: string; query: string }[], currency: string, receipts: ReceiptBook): Promise<Record<string, MarketMatch | null>> {
  const capped = queries.slice(0, 10);
  const results = await Promise.all(
    capped.map(async (q) => [q.id, bestMatch(q.query, await search(q.query, receipts), currency)] as const),
  );
  return Object.fromEntries(results);
}
