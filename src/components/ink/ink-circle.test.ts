import { describe, expect, it } from "vitest";
import { inkCirclePath } from "./ink-circle";

describe("inkCirclePath", () => {
  it("is deterministic for the same box and seed (no hydration mismatch)", () => {
    expect(inkCirclePath([100, 100, 200, 400], 3)).toEqual(inkCirclePath([100, 100, 200, 400], 3));
  });

  it("varies with the seed so neighbouring circles don't look stamped", () => {
    expect(inkCirclePath([100, 100, 200, 400], 3).d).not.toBe(inkCirclePath([100, 100, 200, 400], 4).d);
  });

  it("surrounds the box rather than cutting through it", () => {
    const nums = inkCirclePath([300, 200, 400, 600], 1)
      .d.replace(/[ML]/g, " ")
      .trim()
      .split(/\s+/)
      .map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeLessThan(200);
    expect(Math.max(...xs)).toBeGreaterThan(600);
    expect(Math.min(...ys)).toBeLessThan(300);
    expect(Math.max(...ys)).toBeGreaterThan(400);
  });

  it("reports a length at least the ellipse perimeter, so the dash covers the whole stroke", () => {
    const { length } = inkCirclePath([300, 200, 400, 600], 1);
    // Ellipse with rx≈212, ry≈58 has a perimeter ≈ 900; overshoot makes ours longer.
    expect(length).toBeGreaterThan(900);
  });
});
