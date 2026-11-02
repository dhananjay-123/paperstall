import "server-only";
import { z } from "zod";

// Empty strings from .env files mean "not set", not "set to empty".
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const schema = z.object({
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: optional,
  GEMINI_FAST_MODEL: optional,
  GEMINI_FALLBACK_MODEL: optional,
  PAYPAL_CLIENT_ID: optional,
  PAYPAL_CLIENT_SECRET: optional,
  PAYPAL_ENV: z.enum(["sandbox"]).default("sandbox"),
  PAYPAL_DEMO_PAYEE_EMAIL: z.preprocess((v) => (v === "" ? undefined : v), z.email().optional()),
  PAYLOAD_SIGNING_SECRET: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(32, "PAYLOAD_SIGNING_SECRET must be at least 32 characters").optional(),
  ),
  // Market check is hidden (not broken) when this is unset.
  CHANNEL3_API_KEY: optional,
  NEXT_PUBLIC_APP_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
  MOCK_AI: z
    .enum(["0", "1"])
    .default("0")
    .transform((v) => v === "1"),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}\nSee .env.example.`);
  }
  if (parsed.data.MOCK_AI && process.env.NODE_ENV === "production") {
    throw new Error("MOCK_AI=1 is not allowed in production.");
  }
  return parsed.data;
}

export const env = load();

// Keys stay optional until the phase that needs them; this fails fast with a clear message there.
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === null) {
    throw new Error(`Missing required environment variable ${String(key)}. See .env.example.`);
  }
  return value as NonNullable<Env[K]>;
}
