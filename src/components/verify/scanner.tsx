"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

/** Camera QR scanner: native BarcodeDetector when available, jsQR otherwise. */
export function Scanner({ onCode, paused }: { onCode: (code: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Laptop webcams face the person: mirror the preview so holding a phone up feels natural.
  const [selfie, setSelfie] = useState(false);
  const last = useRef<{ code: string; at: number } | null>(null);
  const cb = useRef(onCode);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    cb.current = onCode;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = BD ? new BD({ formats: ["qr_code"] }) : null;

    const emit = (code: string) => {
      // Ignore the same code for a few seconds so one receipt isn't scanned twice in a row.
      const now = Date.now();
      if (last.current && last.current.code === code && now - last.current.at < 4000) return;
      last.current = { code, at: now };
      cb.current(code);
    };

    const tick = async () => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2 && !pausedRef.current) {
        try {
          if (detector) {
            const found = await detector.detect(v);
            if (found[0]?.rawValue) emit(found[0].rawValue);
          } else if (ctx) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (r?.data) emit(r.data);
          }
        } catch {
          // A bad frame; keep scanning.
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const facing = stream.getVideoTracks()[0]?.getSettings().facingMode;
        setSelfie(facing !== "environment");
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        void tick();
      } catch {
        setError("Camera unavailable. Allow camera access, or type the order ID below.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{error}</p>;
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-black">
      <video ref={video} playsInline muted className={`aspect-square w-full object-cover ${selfie ? "-scale-x-100" : ""}`} aria-label="Camera view for scanning receipt QR codes" />
      <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80" aria-hidden />
      {selfie ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white drop-shadow">Ask the customer to hold their receipt up to the camera</p>
      ) : null}
    </div>
  );
}
