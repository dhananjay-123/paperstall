"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR as an inline SVG data URL (no network, CSP-safe). */
export function Qr({ value, size = 220, label, className }: { value: string; size?: number; label: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#003087", light: "#ffffff" } })
      .then((svg) => alive && setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [value]);
  if (error) return <p className="text-sm text-danger-ink">This link is too long for a QR code. Share the link instead.</p>;
  if (!src) return <div className={`rounded-lg ink-shimmer ${className ?? ""}`} style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element -- generated data URL
  return <img src={src} width={size} height={size} alt={label} className={className} />;
}
