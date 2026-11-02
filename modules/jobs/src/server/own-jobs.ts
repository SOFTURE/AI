// What a signed-in user may see and do with a job they started (`enqueueJob({ ownerId })`): read its state and ask it
// to stop. The owner is part of every statement, so a job of someone else answers exactly like a missing one.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq, sql } from "drizzle-orm";
import type { Job, OwnJob, OwnJobStatus } from "../contract.js";
import { JOB_CANCELLED_CODE } from "../progress.js";
import { jobs } from "../schema.js";
import type { JobsContext } from "./context.js";
import { parseJobId, toJob } from "./job-row.js";

export interface OwnJobInput {
  /** The job's id, as `enqueueJob` returned it; any string is accepted (an unknown one is `jobs.not_found`). */
  readonly id: string;
  /** The signed-in user's id, as passed to `enqueueJob({ ownerId })`. */
  readonly ownerId: string;
}

export type GetOwnJobResult = Ok<OwnJob> | Err<"jobs.not_found">;
export type RequestOwnJobCancelResult = Ok<OwnJob> | Err<"jobs.not_found" | "jobs.not_cancellable">;

/**
 * The job with this id when `ownerId` owns it: state, progress, the result reference and a failure code, never the
 * payload. `jobs.not_found` for a job of someone else, one without an owner, a pruned one or an id that cannot be one.
 */
export async function getOwnJob(ctx: JobsContext, input: OwnJobInput): Promise<GetOwnJobResult> {
  const row = await findOwnRow(ctx, input);
  return row === null ? err("jobs.not_found") : ok(toOwnJob(row));
}

/**
 * `requestJobCancel` for the job's owner: a pending job is `cancelled` at once, a running one is asked to stop and
 * stays `running` until its handler returns. `jobs.not_cancellable` for a finished job, `jobs.not_found` as
 * `getOwnJob`.
 */
export async function requestOwnJobCancel(ctx: JobsContext, input: OwnJobInput): Promise<RequestOwnJobCancelResult> {
  const jobId = parseJobId(input.id);
  if (jobId === null) return err("jobs.not_found");
  const isOwn = and(eq(jobs.id, jobId), eq(jobs.ownerId, input.ownerId));
  const now = ctx.clock.now();
  const [pending] = await ctx.db
    .update(jobs)
    .set({ status: "cancelled", finishedAt: now, updatedAt: now })
    .where(and(isOwn, eq(jobs.status, "pending")))
    .returning();
  if (pending !== undefined) return ok(toOwnJob(toJob(pending)));
  const [running] = await ctx.db
    .update(jobs)
    .set({ cancelRequestedAt: sql`coalesce(${jobs.cancelRequestedAt}, ${now.toISOString()}::timestamptz)` })
    .where(and(isOwn, eq(jobs.status, "running")))
    .returning();
  if (running !== undefined) return ok(toOwnJob(toJob(running)));
  const job = await findOwnRow(ctx, input);
  if (job === null) return err("jobs.not_found");
  // The job left `running` between the statements: pending again (a retry) is cancelled now.
  if (job.status === "pending") return requestOwnJobCancel(ctx, input);
  return err("jobs.not_cancellable");
}

/** The job as its owner sees it. */
export function toOwnJob(job: Job): OwnJob {
  return {
    id: job.id,
    queue: job.queue,
    status: job.status,
    progress: job.progress,
    progressAt: job.progressAt,
    resultRef: job.resultRef,
    failureCode: getFailureCode(job),
    cancelRequestedAt: job.cancelRequestedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
  };
}

/** `OwnJob` as JSON: times as ISO strings. The status route's body. */
export function toOwnJobStatus(job: OwnJob): OwnJobStatus {
  return {
    ...job,
    progressAt: job.progressAt?.toISOString() ?? null,
    cancelRequestedAt: job.cancelRequestedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

function getFailureCode(job: Job): string | null {
  if (job.status === "failed") return job.lastError;
  if (job.status === "cancelled") return JOB_CANCELLED_CODE;
  return null;
}

async function findOwnRow(ctx: JobsContext, input: OwnJobInput): Promise<Job | null> {
  const jobId = parseJobId(input.id);
  if (jobId === null) return null;
  const [row] = await ctx.db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.ownerId, input.ownerId)))
    .limit(1);
  return row === undefined ? null : toJob(row);
}
