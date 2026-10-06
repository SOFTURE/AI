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
    // Global, not per test: some repository tests spawn `tsc` or run ESLint. The slowest test takes
    // about 2.5 s today (the ESLint boundary test); a wide margin keeps a loaded CI runner from
    // failing a test that measures nothing about speed.
    testTimeout: 60_000,
    // Hooks get the same limit: Vitest's default is 10 s. The Chromium launch in the `beforeAll` of the testing
    // package's browser tests (measured 2026-10-06) takes 0.10-0.24 s in a 4-CPU cloud container, idle or beside the
    // full suite, and 0.16 s in a CI run, yet passed 10 s on the 4-core CI runner three times that day while the
    // marketing-kit browser tests launched Chrome beside it (testing-browser-hook-timeout).
    hookTimeout: 60_000,
  },
});
