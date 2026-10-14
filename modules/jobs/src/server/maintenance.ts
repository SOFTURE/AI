// Upkeep and overview: delete finished jobs past their retention, count jobs per queue and status.
import { and, eq, inArray, lt, min, or, sql } from "drizzle-orm";
import { JOB_STATUSES, type JobStatus } from "../contract.js";
import { jobs } from "../schema.js";
import type { JobsContext } from "./context.js";
import { getJobsOptions } from "./options.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows deleted per statement, so pruning a large backlog never holds one long lock. */
const PRUNE_BATCH = 1000;

/**
 * Deletes succeeded, failed and cancelled jobs older (by `finished_at`) than their retention, in batches. Returns the
 * number of deleted jobs. The worker calls it once an hour; an app without a worker may call it from a cron.
 */
export async function pruneJobs(ctx: JobsContext): Promise<number> {
  const { retention } = getJobsOptions(ctx.config);
  const now = ctx.clock.now().getTime();
  const before = (days: number) => new Date(now - days * DAY_MS);
  const isExpired = or(
    and(eq(jobs.status, "succeeded"), lt(jobs.finishedAt, before(retention.succeededDays))),
    and(eq(jobs.status, "failed"), lt(jobs.finishedAt, before(retention.failedDays))),
    and(eq(jobs.status, "cancelled"), lt(jobs.finishedAt, before(retention.cancelledDays))),
  );
  let deleted = 0;
  for (;;) {
    const batch = ctx.db.select({ id: jobs.id }).from(jobs).where(isExpired).limit(PRUNE_BATCH);
    const rows = await ctx.db.delete(jobs).where(inArray(jobs.id, batch)).returning();
    deleted += rows.length;
    if (rows.length < PRUNE_BATCH) return deleted;
  }
}

export interface QueueStats {
  readonly queue: string;
  /** Jobs per status. */
  readonly counts: Readonly<Record<JobStatus, number>>;
  /** Pending jobs whose `run_at` has come: the backlog a worker should be working through. */
  readonly due: number;
  /** The `run_at` of the oldest due pending job, or null: how far behind the workers are. */
  readonly oldestDueAt: Date | null;
}

/**
 * Counts per queue: every configured queue, plus any queue that still has rows in the table. For a dashboard, an ops
 * script or a health check of the app's own (`ops({ checks })`).
 */
export async function getQueueStats(ctx: JobsContext): Promise<QueueStats[]> {
  const now = ctx.clock.now();
  const counted = await ctx.db
    .select({ queue: jobs.queue, status: jobs.status, count: sql<number>`count(*)::int` })
    .from(jobs)
    .groupBy(jobs.queue, jobs.status);
  const backlog = await ctx.db
    .select({ queue: jobs.queue, due: sql<number>`count(*)::int`, oldestDueAt: min(jobs.runAt) })
    .from(jobs)
    .where(and(eq(jobs.status, "pending"), sql`${jobs.runAt} <= ${now}`))
    .groupBy(jobs.queue);

  const names = new Set([...Object.keys(getJobsOptions(ctx.config).queues), ...counted.map((row) => row.queue)]);
  return [...names].map((queue) => {
    const counts = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0])) as Record<JobStatus, number>;
    for (const row of counted.filter((candidate) => candidate.queue === queue)) counts[row.status] = row.count;
    const due = backlog.find((row) => row.queue === queue);
    return { queue, counts, due: due?.due ?? 0, oldestDueAt: due?.oldestDueAt ?? null };
  });
}
