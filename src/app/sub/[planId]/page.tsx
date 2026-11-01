import type { Metadata } from "next";
import { SubscribeView } from "./subscribe-view";

export const metadata: Metadata = { title: "Subscribe", robots: { index: false } };

export default async function SubscribePage({ params }: PageProps<"/sub/[planId]">) {
  const { planId } = await params;
  return <SubscribeView planId={planId} />;
}
