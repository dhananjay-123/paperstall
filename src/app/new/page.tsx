import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { SAMPLES } from "@/lib/samples";
import { CaptureClient } from "./capture-client";

export const metadata: Metadata = { title: "Snap your paper" };

export default function NewPage() {
  // Offer only samples whose photo ships with this build (checked on the server: no 404 probes).
  const available = SAMPLES.filter((s) => existsSync(path.join(process.cwd(), "public", s.image))).map((s) => s.id);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:py-12">
      <header className="space-y-1">
        <p className="font-hand text-xl text-action">step 1 of 3</p>
        <h1 className="font-serif text-4xl text-ink sm:text-5xl">Show me your paper</h1>
        <p className="text-muted-foreground">A price list, a bill for a customer, or a monthly notice. Photo, upload or draw it.</p>
      </header>
      <CaptureClient availableSamples={available} />
    </div>
  );
}
