// PayPal JS SDK + checkout popups/iframes. Re-checked against the SDK v6 docs in Phase 3.
const PAYPAL_SCRIPT = ["https://www.paypal.com", "https://*.paypal.com", "https://*.paypalobjects.com"];
const PAYPAL_FRAME = ["https://www.paypal.com", "https://*.paypal.com", "https://*.venmo.com"];
const PAYPAL_CONNECT = ["https://www.paypal.com", "https://*.paypal.com", "https://*.paypalobjects.com"];
const PAYPAL_IMG = ["https://*.paypal.com", "https://*.paypalobjects.com"];

export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic' lets the nonced PayPal loader pull in its own chunks; the host list is
    // the fallback for browsers without CSP3.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...PAYPAL_SCRIPT,
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Server-rendered style="" attributes (React, motion) can't carry a nonce, so styles allow
    // inline. Scripts stay nonce-only, which is where XSS risk lives.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", ...PAYPAL_IMG],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...PAYPAL_CONNECT, ...(isDev ? ["ws:"] : [])],
    "frame-src": PAYPAL_FRAME,
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://www.paypal.com", "https://*.paypal.com"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export const SECURITY_HEADERS: Record<string, string> = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": 'camera=(self), microphone=(), geolocation=(), payment=(self "https://www.paypal.com")',
};

export const HSTS = "max-age=63072000; includeSubDomains; preload";
