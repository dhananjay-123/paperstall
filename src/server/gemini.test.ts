import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));
process.env.GEMINI_API_KEY = "test";

const { generate, isDailyQuota } = await import("./gemini");

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const DAILY = fail(429, 'RESOURCE_EXHAUSTED: Quota exceeded for metric generate_content_free_tier_requests, limit: 20 per day. Please retry in 41s.');
const BUSY = fail(503, "This model is currently experiencing high demand.");
const call = () => generate({ model: "gemini-3-flash-preview", contents: [{ role: "user", parts: [{ text: "hi" }] }] });

describe("generate fallback", () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("recognises a daily free-tier cap", () => {
    expect(isDailyQuota(DAILY)).toBe(true);
    expect(isDailyQuota(fail(429, "Please retry in 20s."))).toBe(false);
  });

  it("falls back once to another model on a daily cap", async () => {
    generateContent.mockRejectedValueOnce(DAILY).mockResolvedValueOnce({ text: "ok" });
    await expect(call()).resolves.toEqual({ text: "ok" });
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual(["gemini-3-flash-preview", "gemini-3.5-flash"]);
  });

  it("says the reads are used up, instead of counting down, when the fallback is capped too", async () => {
    generateContent.mockRejectedValue(DAILY);
    await expect(call()).rejects.toMatchObject({ status: 429, code: "AI_DAILY_LIMIT" });
  });

  it("answers 'busy' when both models are overloaded", async () => {
    generateContent.mockRejectedValue(BUSY);
    await expect(call()).rejects.toMatchObject({ status: 503, code: "AI_BUSY" });
    expect(generateContent).toHaveBeenCalledTimes(3); // primary once, fallback twice
  });
});
