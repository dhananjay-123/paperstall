"use client";

import { DOORBELL_BASE, parseBell, type Bell } from "@/core/doorbell";
import type { Verdict } from "@/core/verify";
import { api } from "@/lib/api-client";
import type { LedgerEntry } from "@/lib/store";
import type { Stall } from "@/core/stall";

type NtfyEvent = { id?: string; event?: string; message?: string };

/** Subscribe to a stall's topic. `since` replays what arrived while the counter was closed. */
export function listen(
  topic: string,
  since: string,
  on: { bell: (b: Bell, id: string) => void; status: (s: "live" | "reconnecting") => void },
): () => void {
  const es = new EventSource(`${DOORBELL_BASE}/${topic}/sse?since=${encodeURIComponent(since)}`);
  es.onopen = () => on.status("live");
  es.onerror = () => on.status("reconnecting"); // EventSource retries by itself
  es.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data as string) as NtfyEvent;
      const bell = ev.event === "message" ? parseBell(ev.message) : null;
      if (bell && ev.id) on.bell(bell, ev.id);
    } catch {
      // Not ntfy JSON: ignore.
    }
  };
  return () => es.close();
}

/** Order IDs another of the seller's devices already counted (ntfy keeps ~12 hours). */
export async function countedElsewhere(topic: string): Promise<Set<string>> {
  try {
    const res = await fetch(`${DOORBELL_BASE}/${topic}/json?poll=1&since=12h`, { signal: AbortSignal.timeout(4000) });
    const lines = (await res.text()).split("\n").filter(Boolean);
    const ids = lines.flatMap((l) => {
      try {
        const b = parseBell((JSON.parse(l) as NtfyEvent).message);
        return b?.t === "rec" ? [b.o] : [];
      } catch {
        return [];
      }
    });
    return new Set(ids);
  } catch {
    return new Set(); // Offline doorbell: fall back to this device's own ledger.
  }
}

/** Tell the seller's other devices this order is counted. */
export function announceCounted(topic: string, orderId: string) {
  void fetch(`${DOORBELL_BASE}/${topic}`, { method: "POST", body: JSON.stringify({ t: "rec", o: orderId } satisfies Bell) }).catch(() => {});
}

export type CheckResult = { verdict: Verdict; pickupCode?: string; payer?: string };

/** The PayPal check every sale goes through, with this device's ledger plus other devices' counts. */
export async function checkOrder(stall: Stall, ledger: LedgerEntry[], input: { code?: string; orderId?: string }, elsewhere: Set<string> = new Set()) {
  const mine = ledger.filter((l) => l.stallId === stall.id);
  return api<CheckResult>("/api/v1/verify", {
    body: {
      ...input,
      signed: stall.signed,
      recorded: {
        orderIds: [...new Set([...mine.map((l) => l.id), ...elsewhere])],
        captureIds: mine.flatMap((l) => (l.captureId ? [l.captureId] : [])),
        recordedAt: Object.fromEntries(mine.map((l) => [l.id, l.at])),
      },
    },
  });
}
