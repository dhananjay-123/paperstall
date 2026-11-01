"use client";

import type { MarketMatch } from "@/core/market";

const KEY = "paperstall:market:v1";
const TTL = 24 * 60 * 60 * 1000;

type Entry = { at: number; match: MarketMatch | null };

function load(): Record<string, Entry> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Entry>;
  } catch {
    return {};
  }
}

const keyOf = (query: string, currency: string) => `${currency}:${query.trim().toLowerCase()}`;

/** 24 h cache per query to save Channel3 credits. A cached null means "looked, no confident match". */
export function getCached(query: string, currency: string): Entry | undefined {
  const e = load()[keyOf(query, currency)];
  return e && Date.now() - e.at < TTL ? e : undefined;
}

export function putCached(query: string, currency: string, match: MarketMatch | null) {
  try {
    const all = load();
    for (const [k, v] of Object.entries(all)) if (Date.now() - v.at > TTL) delete all[k];
    all[keyOf(query, currency)] = { at: Date.now(), match };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: the check still works, just uncached.
  }
}
