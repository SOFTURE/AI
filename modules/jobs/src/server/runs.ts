// The run history: one row per recorded attempt, written in the transaction that records the attempt's outcome.
import type { Queryable } from "@softure-ai/db";
import type { JobRun } from "../contract.js";
import { runs, type RunRow } from "../schema.js";
import { jobRunSummarySchema, type JobRunSummary } from "../summary.js";

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
