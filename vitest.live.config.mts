import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config.mts";

// `pnpm test:supabase`: runs tests/live against the real Supabase project in .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the variables may already be set in the environment.
}

export default mergeConfig(
  baseConfig,
  defineConfig({ test: { include: ["tests/live/**/*.test.ts"], testTimeout: 20_000 } }),
);
