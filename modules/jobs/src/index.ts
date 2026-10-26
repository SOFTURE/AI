// Public API of @softure-ai/jobs: the module factory for softure.config.ts, the handler helpers and the types.
// Database work is in `@softure-ai/jobs/server`, the worker in `@softure-ai/jobs/worker`, the in-process runner for
// tests in `@softure-ai/jobs/testing`, the admin page and its actions in `/next`, its panel in `/ui`.
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
    version: "0.1.5",
    dependsOn: {},
    dbSchema: "jobs",
    tables: ["jobs", "runs", "schedules", "sync_cursors", "sync_items"],
    env: [],
    switches: [],
    routes: { panel: "/admin/jobs" },
    mount: [{ kind: "page", path: "app/admin/jobs/page.tsx", export: "JobsPage" }],
    privacy: { exports: false, deletes: false },
  },
  messages: jobsMessages,
  options: jobsOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  health: checkJobsTable,
});

export {
  JOB_RUN_OUTCOMES,
  JOB_STATUSES,
  type Job,
  type JobFailedEvent,
  type JobFailure,
  type JobOutcome,
  type JobRun,
  type JobRunOutcome,
  type JobsErrorCode,
  type JobsFormErrorCode,
  type JobsFormState,
  type JobStatus,
  type ScheduleHealth,
  type ScheduleStateChangedEvent,
} from "./contract.js";
export { getJobsErrorMessage, jobsMessages, type JobsMessages } from "./messages/index.js";
export {
  jobsOptionsSchema,
  type DayOfMonth,
  type JobQueueOptions,
  type JobScheduleOptions,
  type JobsPanelGuard,
  type JobSchedulesInput,
  type JobsOptions,
  type JobsOptionsInput,
  type LocalTimeScheduleOptions,
  type OnJobFailedHook,
  type OnScheduleStateChangedHook,
  type PeriodScheduleOptions,
} from "./options.js";
export { defineJobHandler, failJob, retryJobLater, type JobHandler, type JobHandlerContext, type JobHandlers } from "./handlers.js";
export { JOB_STEP_OUTCOMES, jobRunSummarySchema, type JobRunSummary, type JobStepOutcome } from "./summary.js";
export { jobs as jobsTable, runs as jobRunsTable, schedules as jobSchedulesTable, syncCursors as jobSyncCursorsTable, syncItems as jobSyncItemsTable } from "./schema.js";
export {
  failSyncItem,
  skipSyncItem,
  SYNC_ITEM_STATUSES,
  type SyncItem,
  type SyncItemCompletion,
  type SyncItemFailure,
  type SyncItemOutcome,
  type SyncItemRunResult,
  type SyncItemStatus,
} from "./sync.js";
