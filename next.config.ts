import type { NextConfig } from "next";

// cacheComponents / partial prerendering are deliberately off: nonce-based CSP needs every
// page rendered per request (see docs/DECISIONS.md ADR-005).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
