import { defaultClientConditions, defaultServerConditions } from "vite";
import { defineConfig } from "vitest/config";

// Both pins run in the main process before any worker starts, so they hold in every pool.
//
// Time zone: a zone with a negative offset makes a missing explicit zone in code change the
// calendar date, so date tests cannot pass by construction (docs/02-module-standard.md §10,
// FIRE_TRACKER precedent). One-off probe in another zone: `TEST_TZ=Europe/Warsaw npm test`.
process.env.TZ = process.env.TEST_TZ || "America/New_York";
// NODE_ENV: Vitest keeps the shell's value, and the owner's shell exports `production`
// (measured: a test asserting "test" received "production"). React and friends switch builds on it.
process.env.NODE_ENV = "test";

// Workspace packages export `@softure-ai/source` -> `src/*.ts` first, so tests (and `tsc`, through
// `customConditions` in tsconfig.base.json) read sources without building `dist/`.
const SOURCE_CONDITION = "@softure-ai/source";

export default defineConfig({
  resolve: {
    conditions: [SOURCE_CONDITION, ...defaultClientConditions],
  },
  ssr: {
    resolve: {
      conditions: [SOURCE_CONDITION, ...defaultServerConditions],
      externalConditions: [SOURCE_CONDITION],
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "{foundation,modules,tools,templates}/*/{src,tests}/**/*.test.{ts,tsx}",
    ],
    // Random order: no test may depend on running after another.
    sequence: { shuffle: true },
    // A percentage, not a number: CI runners have 2-4 cores, dev machines many more.
    maxWorkers: "50%",
    // Global, not per test: some repository tests spawn `tsc`. Ten times the slowest test keeps a
    // slow machine from failing a test that measures nothing about speed.
    testTimeout: 60_000,
  },
});
