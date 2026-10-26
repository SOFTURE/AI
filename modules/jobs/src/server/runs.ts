// The run history: one row per recorded attempt, written in the transaction that records the attempt's outcome, read
// for an operator's runs page and pruned after its own retention.
import type { Queryable } from "@softure-ai/db";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { JobRun, JobRunOutcome } from "../contract.js";
import { runs, type RunRow } from "../schema.js";
import { jobRunSummarySchema, type JobRunSummary } from "../summary.js";
import type { JobsContext } from "./context.js";
import { getJobsOptions } from "./options.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows deleted per statement, so pruning a large history never holds one long lock. */
const PRUNE_BATCH = 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export interface ListJobRunsInput {
  readonly queue?: string;
  readonly origin?: string;
  /** Only runs that ended so; default every outcome. */
  readonly outcomes?: readonly JobRunOutcome[];
  /** Default 50, at most 500. */
  readonly limit?: number;
}

/** Runs newest first (by when they finished): a runs page's "what did each run do, what started it". Throws on an invalid limit. */
export async function listJobRuns(ctx: JobsContext, input: ListJobRunsInput = {}): Promise<JobRun[]> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  if (!(Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIMIT)) {
    throw new RangeError(`@softure-ai/jobs: listJobRuns limit must be an integer from 1 to ${String(MAX_LIMIT)}`);
  }
  if (input.outcomes?.length === 0) return [];
  const rows = await ctx.db
    .select()
    .from(runs)
    .where(
      and(
        input.queue === undefined ? undefined : eq(runs.queue, input.queue),
        input.origin === undefined ? undefined : eq(runs.origin, input.origin),
        input.outcomes === undefined ? undefined : inArray(runs.outcome, [...input.outcomes]),
      ),
    )
    .orderBy(desc(runs.finishedAt), desc(runs.id))
    .limit(limit);
  return rows.map(toJobRun);
}

/**
 * Deletes runs that finished more than `retention.runsDays` ago, in batches; returns the count. The worker calls it
 * once an hour with `pruneJobs`; an app without a worker calls it from the same cron.
 */
export async function pruneJobRuns(ctx: JobsContext): Promise<number> {
  const cutoff = new Date(ctx.clock.now().getTime() - getJobsOptions(ctx.config).retention.runsDays * DAY_MS);
  let deleted = 0;
  for (;;) {
    const batch = ctx.db.select({ id: runs.id }).from(runs).where(lt(runs.finishedAt, cutoff)).limit(PRUNE_BATCH);
    const rows = await ctx.db.delete(runs).where(inArray(runs.id, batch)).returning({ id: runs.id });
    deleted += rows.length;
    if (rows.length < PRUNE_BATCH) return deleted;
  }
}

export interface RunRecord {
  readonly jobId: string;
  readonly queue: string;
  readonly origin: string;
  readonly attempt: number;
  readonly outcome: JobRun["outcome"];
  readonly errorCode: string | null;
  readonly summary: JobRunSummary | null;
  readonly startedAt: Date | null;
  readonly finishedAt: Date;
}

/** Writes run rows through `db` (the caller's transaction). */
export async function recordRuns(db: Queryable, records: readonly RunRecord[]): Promise<void> {
  if (records.length === 0) return;
  await db.insert(runs).values(records.map((record) => ({ ...record, jobId: BigInt(record.jobId) })));
}

/** The table row as the module's `JobRun`; a stored summary is checked again on the way out. */
export function toJobRun(row: RunRow): JobRun {
  const summary = row.summary === null ? null : jobRunSummarySchema.safeParse(row.summary);
  return {
    id: row.id.toString(),
    jobId: row.jobId.toString(),
    queue: row.queue,
    origin: row.origin,
    attempt: row.attempt,
    outcome: row.outcome,
    errorCode: row.errorCode,
    summary: summary?.success === true ? summary.data : null,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}
