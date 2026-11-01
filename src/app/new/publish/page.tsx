import type { Metadata } from "next";
import { PublishClient } from "./publish-client";

export const metadata: Metadata = { title: "Publish" };

export default async function PublishPage({ searchParams }: PageProps<"/new/publish">) {
  const { intent } = await searchParams;
  const kind = intent === "invoice" || intent === "subscription" ? intent : "shop";
  // The demo payee is a sandbox business account; sellers replace it with their own.
  return <PublishClient intent={kind} defaultPayee={process.env.PAYPAL_DEMO_PAYEE_EMAIL ?? ""} />;
}
