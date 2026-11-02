import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paperstall: Draw it. Snap it. Get paid.",
    short_name: "Paperstall",
    description: "Turn a photo of a price list, a bill or a monthly notice into a real way to get paid with PayPal.",
    start_url: "/studio",
    display: "standalone",
    background_color: "#F7F4EC",
    theme_color: "#003087",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
