import type { Metadata } from "next";
import { ReceiptView } from "./receipt-view";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

export default async function ReceiptPage({ params }: PageProps<"/receipt/[orderId]">) {
  const { orderId } = await params;
  return <ReceiptView orderId={orderId} />;
}
