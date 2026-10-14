// Shared setup: an app configuration with the jobs module and a migrated PGlite database.
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { jobs, type JobsOptionsInput } from "@softure-ai/jobs";
import type { JobsContext } from "@softure-ai/jobs/server";

export const NOW = new Date("2026-09-15T12:00:00Z");
export const SECOND_MS = 1000;

export const QUEUES = {
  "ai.reply": { maxAttempts: 3, backoff: { baseSeconds: 10, maxSeconds: 60 }, leaseSeconds: 60, concurrency: 2 },
  "mail.send": { maxAttempts: 1 },
} satisfies JobsOptionsInput["queues"];

export function createConfig(options: Partial<JobsOptionsInput> = {}): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: "http://localhost:3000",
    modules: [jobs({ queues: QUEUES, ...options })],
  });
}

export interface TestJobs {
  readonly ctx: JobsContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
}

export async function createTestJobs(options: Partial<JobsOptionsInput> = {}): Promise<TestJobs> {
  const config = createConfig(options);
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database };
}
