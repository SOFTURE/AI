// Test helpers of @softure-ai/jobs: run due jobs in-process against a test database (`createTestDatabase` from
// `@softure-ai/db/testing`) and read the table back.
import type { Queryable } from "@softure-ai/db";
import { asc } from "drizzle-orm";
import type { Job } from "../contract.js";
import { jobs } from "../schema.js";
import { toJob } from "../server/job-row.js";

export { runDueJobs, type RunDueJobsOptions, type RunDueJobsReport } from "../server/run-due.js";

/** Every job in the table, oldest first: for assertions. */
export async function listJobs(db: Queryable): Promise<Job[]> {
  const rows = await db.select().from(jobs).orderBy(asc(jobs.id));
  return rows.map(toJob);
}
