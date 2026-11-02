import type { Metadata } from "next";
import { CounterClient } from "./counter-client";

export const metadata: Metadata = { title: "Live counter", robots: { index: false } };

export default async function CounterPage({ searchParams }: PageProps<"/counter">) {
  const { stall } = await searchParams;
  return <CounterClient initialStall={typeof stall === "string" ? stall : undefined} />;
}
