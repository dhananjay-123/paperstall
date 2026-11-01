import type { Metadata } from "next";
import { InvoiceView } from "./invoice-view";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

export default async function InvoicePage({ params }: PageProps<"/i/[invoiceId]">) {
  const { invoiceId } = await params;
  return <InvoiceView id={invoiceId} />;
}
