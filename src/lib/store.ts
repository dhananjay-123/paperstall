"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Receipt } from "@/core/receipts";
import type { Read } from "@/core/read/schema";
import type { StallItem, Stall } from "@/core/stall";
import { onReceipts } from "@/lib/api-client";

export type LedgerKind = "order" | "invoice" | "subscription";

export type LedgerEntry = {
  id: string; // PayPal order / invoice / subscription id
  kind: LedgerKind;
  stallId: string;
  at: string; // ISO
  customer?: string;
  items: { name: string; quantity: number }[];
  currency: string;
  totalMinor: number;
  status: string;
  captureId?: string;
  refundedMinor?: number;
  tracking?: { number: string; carrier: string };
  verifiedVia: "scan" | "manual" | "counter" | "invoice-status" | "penny";
};

export type InvoiceRecord = {
  id: string;
  stallId: string;
  number?: string;
  customer: string;
  email?: string;
  currency: string;
  totalMinor: number;
  status: string;
  payerUrl?: string;
  qrPng?: string; // base64
  createdAt: string;
  dueDate?: string;
  lastCheckedAt?: string;
};

export type PlanRecord = {
  stallId: string;
  productId: string;
  planId: string;
  name: string;
  currency: string;
  priceMinor: number;
  interval: "week" | "month" | "year";
  createdAt: string;
  subscriptionIds: string[];
};

export type Settings = {
  payeeEmail: string;
  displayCurrency: string;
  fxRate: number; // 1 unit of stall currency in display currency, seller-set
  fxRateDate: string;
  sound: boolean;
  language: string;
};

export type DraftRead = {
  id: string;
  imageDataUrl: string; // downscaled JPEG
  read: Read | null;
  cached?: boolean;
  sampleId?: string;
  startedAt: number;
  publishedAt?: number;
  edits: number;
};

type State = {
  version: 1;
  stalls: Stall[];
  ledger: LedgerEntry[];
  invoices: InvoiceRecord[];
  plans: PlanRecord[];
  receipts: Receipt[];
  settings: Settings;
  draft: DraftRead | null;
  art: Record<string, string>; // itemKey → webp data URL
  artOrder: string[]; // LRU, oldest first
};

type Actions = {
  setDraft(d: DraftRead | null): void;
  patchDraft(p: Partial<DraftRead>): void;
  upsertStall(s: Stall): void;
  removeStall(id: string): void;
  addLedger(e: LedgerEntry): boolean;
  patchLedger(id: string, p: Partial<LedgerEntry>): void;
  upsertInvoice(i: InvoiceRecord): void;
  upsertPlan(p: PlanRecord): void;
  addReceipts(r: Receipt[]): void;
  setSettings(p: Partial<Settings>): void;
  putArt(key: string, dataUrl: string): void;
  reset(): void;
  importData(json: unknown): void;
};

const ART_BUDGET = 1_500_000; // chars of data URLs kept in localStorage
const RECEIPT_CAP = 300;

const initial: State = {
  version: 1,
  stalls: [],
  ledger: [],
  invoices: [],
  plans: [],
  receipts: [],
  settings: {
    payeeEmail: process.env.NEXT_PUBLIC_DEMO_PAYEE_EMAIL ?? "",
    displayCurrency: "USD",
    fxRate: 1,
    fxRateDate: "2026-11-01",
    sound: true,
    language: "en",
  },
  draft: null,
  art: {},
  artOrder: [],
};

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,
      setDraft: (d) => set({ draft: d }),
      patchDraft: (p) => set((s) => (s.draft ? { draft: { ...s.draft, ...p } } : s)),
      upsertStall: (stall) =>
        set((s) => ({ stalls: [stall, ...s.stalls.filter((x) => x.id !== stall.id)] })),
      removeStall: (id) => set((s) => ({ stalls: s.stalls.filter((x) => x.id !== id) })),
      // Dedupe by PayPal id and capture id: replay protection for verify.
      addLedger: (e) => {
        const dup = get().ledger.some((x) => x.id === e.id || (e.captureId && x.captureId === e.captureId));
        if (dup) return false;
        set((s) => ({ ledger: [e, ...s.ledger] }));
        return true;
      },
      patchLedger: (id, p) => set((s) => ({ ledger: s.ledger.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      upsertInvoice: (inv) => set((s) => ({ invoices: [inv, ...s.invoices.filter((x) => x.id !== inv.id)] })),
      upsertPlan: (p) => set((s) => ({ plans: [p, ...s.plans.filter((x) => x.planId !== p.planId)] })),
      addReceipts: (r) => set((s) => ({ receipts: [...r, ...s.receipts].slice(0, RECEIPT_CAP) })),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      putArt: (key, dataUrl) =>
        set((s) => {
          const art = { ...s.art, [key]: dataUrl };
          const order = [...s.artOrder.filter((k) => k !== key), key];
          let size = Object.values(art).reduce((n, v) => n + v.length, 0);
          // Evict least-recently-stored art until we fit the budget.
          while (size > ART_BUDGET && order.length > 1) {
            const old = order.shift()!;
            size -= art[old]?.length ?? 0;
            delete art[old];
          }
          return { art, artOrder: order };
        }),
      reset: () => set({ ...initial }),
      importData: (json) => {
        const data = json as Partial<State>;
        if (!data || data.version !== 1 || !Array.isArray(data.stalls)) throw new Error("This file isn't a Paperstall export.");
        set({ ...initial, ...data, draft: null });
      },
    }),
    {
      name: "paperstall:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { draft, ...rest } = s;
        // Drafts carry a full photo; keep them only for the current session.
        void draft;
        return rest;
      },
      // Ready for v2: transform persisted v1 state here when the shape changes.
      migrate: (persisted, version) => {
        if (version === 1) return persisted as State & Actions;
        return initial as State & Actions;
      },
    },
  ),
);

if (typeof window !== "undefined") {
  onReceipts((r) => useStore.getState().addReceipts(r));
}

export function itemArtKey(stallId: string, item: Pick<StallItem, "id">) {
  return `${stallId}:${item.id}`;
}
