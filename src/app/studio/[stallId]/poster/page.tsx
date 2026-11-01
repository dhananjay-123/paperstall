import type { Metadata } from "next";
import { Poster } from "./poster";

export const metadata: Metadata = { title: "Scan to pay poster", robots: { index: false } };

export default async function PosterPage({ params }: PageProps<"/studio/[stallId]/poster">) {
  const { stallId } = await params;
  return <Poster stallId={stallId} />;
}
