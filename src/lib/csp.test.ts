import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

function directive(csp: string, name: string): string[] {
  const part = csp.split("; ").find((p) => p.startsWith(`${name} `));
  return part ? part.split(" ").slice(1) : [];
}

describe("buildCsp", () => {
  const prod = buildCsp("abc123", false);
  const dev = buildCsp("abc123", true);

  it("allows scripts only by nonce in production (no unsafe-inline / unsafe-eval)", () => {
    const scripts = directive(prod, "script-src");
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("only adds unsafe-eval in development", () => {
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
  });

  it("blocks framing and plugins", () => {
    expect(directive(prod, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(prod, "object-src")).toEqual(["'none'"]);
  });

  it("allow-lists PayPal for scripts and checkout frames, and nothing else third-party", () => {
    const thirdParty = [...directive(prod, "script-src"), ...directive(prod, "frame-src")].filter((s) =>
      s.startsWith("https://"),
    );
    expect(thirdParty.length).toBeGreaterThan(0);
    for (const host of thirdParty) expect(host).toMatch(/paypal\.com|paypalobjects\.com|venmo\.com/);
  });

  it("upgrades insecure requests in production only", () => {
    expect(prod).toContain("upgrade-insecure-requests");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});
