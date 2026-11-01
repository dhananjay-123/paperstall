import type { Metadata } from "next";
import { Storefront } from "./storefront";

export const metadata: Metadata = { title: "Stall", robots: { index: false } };

// The stall lives in the URL hash, which never reaches the server; the page renders on the client.
export default function StallPage() {
  return <Storefront />;
}
