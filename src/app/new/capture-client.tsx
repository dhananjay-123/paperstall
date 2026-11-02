"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, ImageUp, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downscale } from "@/lib/image";
import { SAMPLES, type Sample } from "@/lib/samples";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// The drawing canvas is only loaded when someone picks "Draw".
const DrawPad = dynamic(() => import("@/components/capture/draw-pad").then((m) => m.DrawPad), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full rounded-xl ink-shimmer" />,
});

export type Mode = "photo" | "draw" | "samples";

export function CaptureClient({ availableSamples, initialMode = "photo" }: { availableSamples: string[]; initialMode?: Mode }) {
  const router = useRouter();
  const setDraft = useStore((s) => s.setDraft);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const samples: Sample[] = SAMPLES.filter((s) => availableSamples.includes(s.id));
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);


  async function start(src: Blob | string, sampleId?: string) {
    setBusy(true);
    setError(null);
    try {
      const imageDataUrl = await downscale(src);
      setDraft({ id: crypto.randomUUID(), imageDataUrl, read: null, sampleId, startedAt: Date.now(), edits: 0 });
      router.push("/new/read");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image couldn't be used.");
      setBusy(false);
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void start(f);
  };

  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "photo", label: "Photo", icon: <Camera /> },
    { id: "draw", label: "Draw", icon: <PenLine /> },
    { id: "samples", label: "Samples", icon: <Sparkles /> },
  ];

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="How to capture" className="inline-flex rounded-xl border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
              mode === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {mode === "photo" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => camera.current?.click()}
            className="group flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-action/50 bg-card text-center outline-none hover:border-action focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <Camera className="size-10 text-action transition-transform group-hover:-rotate-6" />
            <span className="font-serif text-2xl text-ink">Take a photo</span>
            <span className="text-sm text-muted-foreground">Uses your phone&apos;s camera</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => upload.current?.click()}
            className="group flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card text-center outline-none hover:border-ink focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <ImageUp className="size-10 text-ink transition-transform group-hover:-translate-y-0.5" />
            <span className="font-serif text-2xl text-ink">Upload a picture</span>
            <span className="text-sm text-muted-foreground">JPEG, PNG or WebP</span>
          </button>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} aria-label="Take a photo" />
          <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} aria-label="Upload a picture" />
        </div>
      ) : null}

      {mode === "draw" ? <DrawPad busy={busy} onDone={(png) => void start(png)} /> : null}

      {mode === "samples" ? (
        samples.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {samples.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => void start(s.image, s.id)}
                className="overflow-hidden rounded-xl border bg-card text-left outline-none hover:border-action focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local sample photos, already small */}
                <img src={s.image} alt={s.title} className="h-36 w-full object-cover" />
                <div className="p-3">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.hint}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No sample photos on this build yet. Take a photo of any price list, or draw one.
          </p>
        )
      ) : null}

      {busy ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Getting the paper ready…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
      <div className="text-xs text-muted-foreground">
        <Button variant="link" size="xs" className="h-auto p-0" asChild>
          <a href="/privacy">What happens to my photo?</a>
        </Button>
      </div>
    </div>
  );
}
