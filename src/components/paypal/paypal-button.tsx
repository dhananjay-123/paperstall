"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { loadCoreSdkScript } from "@paypal/paypal-js/sdk-v6";

// PayPal JS SDK v6. One-time payments and subscriptions are both supported in v6
// (components "paypal-payments" and "paypal-subscriptions"), so we use v6 for both.

type Common = {
  currency: string;
  disabled?: boolean;
  onError: (message: string) => void;
  onCancel?: () => void;
};

type OneTime = Common & {
  kind: "order";
  createOrder: () => Promise<{ orderId: string }>;
  onApprove: (orderId: string) => Promise<void>;
};

type Sub = Common & {
  kind: "subscription";
  createSubscription: () => Promise<{ subscriptionId: string }>;
  onApprove: (subscriptionId: string) => Promise<void>;
};

const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

type Session = { start: (opts: { presentationMode: "auto" | "popup" | "modal" }, p: Promise<unknown>) => Promise<unknown> };

export function PayPalButton(props: OneTime | Sub) {
  const [state, setState] = useState<"loading" | "ready" | "ineligible" | "unconfigured" | "failed">(CLIENT_ID ? "loading" : "unconfigured");
  const session = useRef<Session | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    (async () => {
      try {
        const paypal = await loadCoreSdkScript({ environment: "sandbox" });
        if (!paypal || cancelled) return;
        const component = latest.current.kind === "order" ? "paypal-payments" : "paypal-subscriptions";
        const sdk = await paypal.createInstance({ clientId: CLIENT_ID, components: [component], pageType: "checkout" });
        if (latest.current.kind === "order") {
          const eligible = await sdk.findEligibleMethods({ currencyCode: latest.current.currency });
          if (!eligible.isEligible("paypal")) {
            if (!cancelled) setState("ineligible");
            return;
          }
          session.current = (sdk as unknown as { createPayPalOneTimePaymentSession: (o: object) => Session }).createPayPalOneTimePaymentSession({
            onApprove: async (d: { orderId: string }) => {
              const p = latest.current;
              if (p.kind === "order") await p.onApprove(d.orderId);
            },
            onCancel: () => latest.current.onCancel?.(),
            onError: (e: { message?: string }) => latest.current.onError(e?.message ?? "PayPal couldn't complete the payment."),
          });
        } else {
          session.current = (sdk as unknown as { createPayPalSubscriptionPaymentSession: (o: object) => Session }).createPayPalSubscriptionPaymentSession({
            onApprove: async (d: { subscriptionId: string }) => {
              const p = latest.current;
              if (p.kind === "subscription") await p.onApprove(d.subscriptionId);
            },
            onCancel: () => latest.current.onCancel?.(),
            onError: (e: { message?: string }) => latest.current.onError(e?.message ?? "PayPal couldn't start the subscription."),
          });
        }
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const button = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = button.current;
    if (state !== "ready" || !el) return;
    const onClick = () => void startSession(session.current, latest.current);
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [state]);

  if (state === "unconfigured") return <Notice>PayPal isn&apos;t configured on this site yet (missing client ID).</Notice>;
  if (state === "failed") return <Notice>PayPal didn&apos;t load. Check your connection and refresh.</Notice>;
  if (state === "ineligible") return <Notice>PayPal isn&apos;t available for {props.currency} payments here.</Notice>;
  if (state === "loading") return <div className="h-11 w-full rounded-full ink-shimmer" aria-label="Loading PayPal" />;

  // v6 renders PayPal's official button as a custom element; we only wire the click.
  return (
    <div className={props.disabled ? "pointer-events-none opacity-50" : ""}>
      {createElement("paypal-button", { type: "pay", ref: button, class: "block w-full" })}
    </div>
  );
}

async function startSession(s: Session | null, p: OneTime | Sub) {
  if (!s || p.disabled) return;
  try {
    const promise = p.kind === "order" ? p.createOrder() : p.createSubscription();
    await s.start({ presentationMode: "auto" }, promise);
  } catch (e) {
    p.onError(e instanceof Error ? e.message : "PayPal couldn't start.");
  }
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-ink">{children}</p>;
}
