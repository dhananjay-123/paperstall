import { describe, expect, it } from "vitest";
import { parseBell } from "@/core/doorbell";
import { newTopic, openTopic, pickupCode, sealTopic } from "./doorbell";

const SECRET = "test-secret-at-least-32-characters-long";

describe("doorbell topic sealing", () => {
  it("round-trips with the right secret", () => {
    const topic = newTopic();
    expect(openTopic(sealTopic(topic, SECRET), SECRET)).toBe(topic);
  });

  it("can't be opened with another secret or after tampering", () => {
    const sealed = sealTopic(newTopic(), SECRET);
    expect(openTopic(sealed, "another-secret-another-secret-123")).toBeNull();
    const flipped = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(openTopic(flipped, SECRET)).toBeNull();
  });

  it("gives every publish a different, URL-safe topic", () => {
    const a = newTopic();
    expect(a).not.toBe(newTopic());
    expect(a).toMatch(/^[A-Za-z0-9_-]{1,64}$/); // ntfy topic rules
  });
});

describe("pickup code", () => {
  it("is stable per order and secret, 4 unambiguous characters", () => {
    const code = pickupCode("6VU297505J010243X", SECRET);
    expect(code).toBe(pickupCode("6VU297505J010243X", SECRET));
    expect(code).toMatch(/^[ACDEFGHJKMNPQRTUVWXY34679]{4}$/);
    expect(pickupCode("6VU297505J010243X", "another-secret-another-secret-123")).not.toBe(code);
  });
});

describe("parseBell", () => {
  it("accepts only our two message shapes", () => {
    expect(parseBell(JSON.stringify({ t: "paid", o: "6VU297505J010243X" }))).toEqual({ t: "paid", o: "6VU297505J010243X" });
    expect(parseBell(JSON.stringify({ t: "refund", o: "6VU297505J010243X" }))).toBeNull();
    expect(parseBell(JSON.stringify({ t: "paid", o: "../../etc" }))).toBeNull();
    expect(parseBell("hello")).toBeNull();
  });
});
