import type { Metadata } from "next";
import { Studio } from "./studio";

export const metadata: Metadata = { title: "Studio", robots: { index: false } };

export default async function StudioPage({ params }: PageProps<"/studio/[stallId]">) {
  const { stallId } = await params;
  return <Studio stallId={stallId} />;
}
