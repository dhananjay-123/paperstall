"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Stall } from "@/core/stall";
import { ApiCallError } from "@/lib/api-client";
import { announceCounted, checkOrder, countedElsewhere, listen } from "@/lib/doorbell-client";
import { kaching } from "@/lib/sound";
import { useStore } from "@/lib/store";

export type CounterIssue = { orderId: string; message: string; retry: boolean };
export type CounterStatus = "off" | "connecting" | "live" | "reconnecting" | "other-tab";

const sinceKey = (stallId: string) => `paperstall:counter-since:${stallId}`;

/**
 * Listens to the stall's doorbell and records each paid order after checking it with PayPal.
 * One tab per stall holds a Web Lock, so two tabs never record the same doorbell.
 */
export function useLiveCounter(stall: Stall | undefined) {
  const topic = stall?.doorbell;
  const stallId = stall?.id;
  const [lock, setLock] = useState<"pending" | "held" | "busy">("pending");
  const [conn, setConn] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [issues, setIssues] = useState<CounterIssue[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const handle = useRef<(orderId: string) => Promise<void>>(async () => {});

  useEffect(() => {
    if (!topic || !stallId) return;
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    if (!locks) {
      queueMicrotask(() => setLock("held"));
    } else {
      void locks.request(`paperstall-counter-${stallId}`, { ifAvailable: true }, async (l) => {
        if (!l) return setLock("busy");
        setLock("held");
        await held;
      });
    }
    return () => release();
  }, [topic, stallId]);

  const check = useCallback(
    async (orderId: string, elsewhere: Set<string>) => {
      if (!stall || !topic) return;
      const st = useStore.getState();
      if (st.ledger.some((l) => l.id === orderId)) return;
      setIssues((x) => x.filter((i) => i.orderId !== orderId));
      try {
        const { verdict, pickupCode, payer } = await checkOrder(stall, st.ledger, { orderId }, elsewhere);
        if (verdict.ok) {
          const wrote = st.addLedger({
            id: verdict.orderId,
            kind: "order",
            stallId: stall.id,
            at: verdict.paidAt ?? new Date().toISOString(),
            items: verdict.items.map((i) => ({ name: i.name, quantity: i.quantity })),
            currency: verdict.currency,
            totalMinor: verdict.totalMinor,
            status: "COMPLETED",
            captureId: verdict.captureId,
            verifiedVia: "doorbell",
            pickupCode,
            payer,
          });
          if (wrote) {
            announceCounted(topic, verdict.orderId);
            if (st.settings.sound) kaching();
            setFresh(verdict.orderId);
          }
        } else if (verdict.reason !== "already_recorded") {
          // A doorbell that PayPal doesn't back up: show it, never count it.
          setIssues((x) => [{ orderId, message: verdict.message, retry: verdict.reason === "not_paid" }, ...x].slice(0, 6));
        }
      } catch (e) {
        setIssues((x) => [{ orderId, message: e instanceof ApiCallError ? e.error.message : "Couldn’t reach PayPal to check it", retry: true }, ...x].slice(0, 6));
      }
    },
    [stall, topic],
  );

  useEffect(() => {
    if (lock !== "held" || !topic || !stallId) return;
    const elsewhere = new Set<string>();
    const seen = new Set<string>();
    let chain = countedElsewhere(topic).then((ids) => ids.forEach((id) => elsewhere.add(id)));
    handle.current = (orderId) => (chain = chain.then(() => check(orderId, elsewhere)));

    let since = "3h";
    try {
      since = localStorage.getItem(sinceKey(stallId)) ?? since;
    } catch {}
    return listen(topic, since, {
      status: setConn,
      bell: (bell, id) => {
        try {
          localStorage.setItem(sinceKey(stallId), id);
        } catch {}
        if (bell.t === "rec") return void elsewhere.add(bell.o);
        if (seen.has(bell.o)) return;
        seen.add(bell.o);
        void handle.current(bell.o);
      },
    });
  }, [lock, topic, stallId, check]);

  const status: CounterStatus = !topic ? "off" : lock === "busy" ? "other-tab" : lock === "pending" ? "connecting" : conn;
  return { status, issues, fresh, retry: (orderId: string) => void handle.current(orderId) };
}
