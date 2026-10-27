// Test helpers of @softure-ai/jobs: run due jobs in-process against a test database (`createTestDatabase` from
// `@softure-ai/db/testing`), read the tables back (the run history too) and record the alert hooks' calls.
import type { Queryable } from "@softure-ai/db";
import { asc } from "drizzle-orm";
import type { Job, JobFailedEvent, JobRun, ScheduleStateChangedEvent } from "../contract.js";
import type { OnJobFailedHook, OnScheduleStateChangedHook } from "../options.js";
import { jobs, runs, syncCursors, syncItems } from "../schema.js";
import { toJob } from "../server/job-row.js";
import { toJobRun } from "../server/runs.js";
import { toSyncItem } from "../server/sync-items.js";
import type { SyncItem } from "../sync.js";

export { runDueJobs, type RunDueJobsOptions, type RunDueJobsReport } from "../server/run-due.js";

/** Every job in the table, oldest first: for assertions. */
export async function listJobs(db: Queryable): Promise<Job[]> {
  const rows = await db.select().from(jobs).orderBy(asc(jobs.id));
  return rows.map(toJob);
}

/** Every row of the run history, oldest first: for assertions. */
export async function listRunHistory(db: Queryable): Promise<JobRun[]> {
  const rows = await db.select().from(runs).orderBy(asc(runs.id));
  return rows.map(toJobRun);
}

export interface SyncState {
  /** Every source's cursor, by source name. */
  readonly cursors: Readonly<Record<string, string>>;
  /** Every ledger item, by source and then item id. */
  readonly items: SyncItem[];
}

/** The whole sync state, cursors and ledger: for assertions after a test ran its polling job (`runDueJobs`). */
export async function listSyncState(db: Queryable): Promise<SyncState> {
  const cursors = await db.select().from(syncCursors).orderBy(asc(syncCursors.source));
  const items = await db.select().from(syncItems).orderBy(asc(syncItems.source), asc(syncItems.itemId));
  return { cursors: Object.fromEntries(cursors.map((row) => [row.source, row.cursor])), items: items.map(toSyncItem) };
}

export interface JobHookRecorder {
  /** Spread into `jobs({ ... })` of the test's config: `jobs({ queues, ...recorder.options })`. */
  readonly options: { readonly onJobFailed: OnJobFailedHook; readonly onScheduleStateChanged: OnScheduleStateChangedHook };
  /** Every `onJobFailed` call, in order. */
  readonly failedJobs: JobFailedEvent[];
  /** Every `onScheduleStateChanged` call, in order. */
  readonly scheduleStateChanges: ScheduleStateChangedEvent[];
}

/** Hooks that record their calls, for asserting the alerts a test's `runDueJobs` raised. */
export function recordJobHooks(): JobHookRecorder {
  const failedJobs: JobFailedEvent[] = [];
  const scheduleStateChanges: ScheduleStateChangedEvent[] = [];
  return {
    options: {
      onJobFailed: (event) => {
        failedJobs.push(event);
      },
      onScheduleStateChanged: (event) => {
        scheduleStateChanges.push(event);
      },
    },
    failedJobs,
    scheduleStateChanges,
  };
}
