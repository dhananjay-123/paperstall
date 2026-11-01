"use client";

import type { Box } from "@/components/ink/ink-circle";

export const MAX_SIDE = 1600;
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

async function loadBitmap(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error("That image couldn't be opened. Try a JPEG or PNG photo.");
  } finally {
    if (typeof src !== "string") setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Longest side ≤ 1600px, JPEG q≈0.8, on a white background (PNG transparency, drawings). */
export async function downscale(src: Blob | string, maxSide = MAX_SIDE, quality = 0.8): Promise<string> {
  if (src instanceof Blob) {
    if (src.size > MAX_INPUT_BYTES) throw new Error("That file is over 25 MB. Try a smaller photo.");
    if (src.type && !src.type.startsWith("image/")) throw new Error("That file isn't an image.");
  }
  const img = await loadBitmap(src);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process the image.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Crops a 0–1000 box (padded) to a small WebP: the seller's own handwriting as item art. */
export async function cropBox(dataUrl: string, box: Box, maxSide = 240): Promise<string | null> {
  try {
    const img = await loadBitmap(dataUrl);
    const [ymin, xmin, ymax, xmax] = box;
    const pad = 12;
    const x = Math.max(0, ((xmin - pad) / 1000) * img.naturalWidth);
    const y = Math.max(0, ((ymin - pad) / 1000) * img.naturalHeight);
    const w = Math.min(img.naturalWidth - x, ((xmax - xmin + pad * 2) / 1000) * img.naturalWidth);
    const h = Math.min(img.naturalHeight - y, ((ymax - ymin + pad * 2) / 1000) * img.naturalHeight);
    if (w < 4 || h < 4) return null;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d")?.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", 0.7);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
