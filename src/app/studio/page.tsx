import type { Metadata } from "next";
import { StudioIndex } from "./studio-index";

export const metadata: Metadata = { title: "My stalls", robots: { index: false } };

export default function StudioIndexPage() {
  return <StudioIndex />;
}
