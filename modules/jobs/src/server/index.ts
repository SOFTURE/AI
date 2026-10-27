// Server-only API of @softure-ai/jobs. Every function receives the module context (`{ db, clock, config }`); `db`
// may be an open transaction.
export {
  cancelJob,
  getJob,
  listRecentJobs,
  retryJob,
  type CancelJobResult,
  type ListRecentJobsInput,
  type RecentJobStatus,
  type RetryJobResult,
} from "./admin.js";
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
export { checkScheduleStates, getScheduleHealth, notifyJobFailed, type HookOptions } from "./hooks.js";
export { consoleJobsLogger, type JobsLogFields, type JobsLogger } from "./logger.js";
export { getQueueStats, pruneJobs, type QueueStats } from "./maintenance.js";
export { getJobsOptions, getJobsRoutes } from "./options.js";
export { listJobRuns, pruneJobRuns, type ListJobRunsInput } from "./runs.js";
export { runClaimedJob, type RunClaimedJobOptions } from "./process.js";
export {
  enqueueDueSchedules,
  getScheduleSlot,
  runScheduleNow,
  SCHEDULE_DEDUP_KEY,
  type EnqueueDueSchedulesInput,
  type RunScheduleNowOptions,
  type RunScheduleNowResult,
  type ScheduleState,
} from "./schedules.js";
export { advanceSyncCursor, getSyncCursor, SYNC_SOURCE, type AdvanceSyncCursorInput } from "./sync-cursors.js";
export {
  listSyncItems,
  processSyncItem,
  pruneSyncItems,
  reopenSyncItem,
  retrySyncItem,
  type ListSyncItemsInput,
  type ProcessSyncItemInput,
  type ReopenSyncItemInput,
  type ReopenSyncItemResult,
  type RetrySyncItemInput,
  type RetrySyncItemResult,
  type SyncItemContext,
} from "./sync-items.js";
export { runDueJobs, type RunDueJobsOptions, type RunDueJobsReport } from "./run-due.js";
