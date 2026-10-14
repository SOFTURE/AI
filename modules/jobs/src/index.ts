// Public API of @softure-ai/jobs: the module factory for softure.config.ts, the handler helpers and the types.
// Database work is in `@softure-ai/jobs/server`, the worker in `@softure-ai/jobs/worker`, the in-process runner for
// tests in `@softure-ai/jobs/testing`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { jobsMessages } from "./messages/index.js";
import { jobsOptionsSchema } from "./options.js";
import { checkJobsTable } from "./server/health.js";

export const MODULE_ID = "jobs";

/**
 * Enables background jobs in `softure.config.ts`: `jobs({ queues: { "ai.reply": { maxAttempts: 5 } } })`. Jobs run
 * in a worker process (`runJobWorkerProcess` from `@softure-ai/jobs/worker`).
 */
export const jobs = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.1",
    dependsOn: {},
    dbSchema: "jobs",
    tables: ["jobs", "schedules"],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  },
  messages: jobsMessages,
  options: jobsOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  health: checkJobsTable,
});

export {
  JOB_STATUSES,
  type Job,
  type JobFailure,
  type JobOutcome,
  type JobsErrorCode,
  type JobStatus,
} from "./contract.js";
export { jobsMessages, type JobsMessages } from "./messages/index.js";
export {
  jobsOptionsSchema,
  type JobQueueOptions,
  type JobScheduleOptions,
  type JobSchedulesInput,
  type JobsOptions,
  type JobsOptionsInput,
} from "./options.js";
export { defineJobHandler, failJob, retryJobLater, type JobHandler, type JobHandlerContext, type JobHandlers } from "./handlers.js";
export { jobs as jobsTable, schedules as jobSchedulesTable } from "./schema.js";
