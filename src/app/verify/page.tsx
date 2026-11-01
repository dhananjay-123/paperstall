import type { Metadata } from "next";
import { VerifyClient } from "./verify-client";

export const metadata: Metadata = { title: "Scan to confirm payment", robots: { index: false } };

export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const { stall } = await searchParams;
  return <VerifyClient initialStall={typeof stall === "string" ? stall : undefined} />;
}
