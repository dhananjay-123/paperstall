import type { Metadata } from "next";
import { ReadClient } from "./read-client";

export const metadata: Metadata = { title: "The Read" };

export default function ReadPage() {
  return <ReadClient />;
}
