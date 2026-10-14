// Server-only API of @softure-ai/jobs. Every function receives the module context (`{ db, clock, config }`); `db`
// may be an open transaction.
export { cancelJob, getJob, retryJob, type CancelJobResult, type RetryJobResult } from "./admin.js";
export {
  claimJobs,
  completeJob,
  extendJobLease,
  releaseJob,
  type ClaimedJob,
  type ClaimJobsInput,
  type Completion,
} from "./claim.js";
export type { JobsContext } from "./context.js";
export { enqueueJob, type EnqueuedJob, type EnqueueJobInput } from "./enqueue.js";
export { consoleJobsLogger, type JobsLogFields, type JobsLogger } from "./logger.js";
export { getQueueStats, pruneJobs, type QueueStats } from "./maintenance.js";
export { getJobsOptions } from "./options.js";
export { runClaimedJob, type RunClaimedJobOptions } from "./process.js";
export {
  enqueueDueSchedules,
  getScheduleSlot,
  SCHEDULE_DEDUP_KEY,
  type EnqueueDueSchedulesInput,
  type ScheduleState,
} from "./schedules.js";
export { runDueJobs, type RunDueJobsOptions, type RunDueJobsReport } from "./run-due.js";
