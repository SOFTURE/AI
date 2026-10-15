// Reading and steering single jobs: look one up, cancel one that has not started, run a failed one again.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { isConstraintViolation } from "@softure-ai/db";
import { and, eq, inArray } from "drizzle-orm";
import type { Job } from "../contract.js";
import { jobs } from "../schema.js";
import type { JobsContext } from "./context.js";
import { parseJobId, toJob } from "./job-row.js";

const UNIQUE_VIOLATION = "23505";

export type CancelJobResult = Ok<Job> | Err<"jobs.not_found" | "jobs.not_cancellable">;
export type RetryJobResult = Ok<Job> | Err<"jobs.not_found" | "jobs.not_retryable" | "jobs.dedup_key_taken">;

/** The job with this id, or null. */
export async function getJob(ctx: JobsContext, id: string): Promise<Job | null> {
  const jobId = parseJobId(id);
  if (jobId === null) return null;
  const [row] = await ctx.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return row === undefined ? null : toJob(row);
}

/** Cancels a pending job (also one waiting for a retry). A running job cannot be cancelled: its handler has the work. */
export async function cancelJob(ctx: JobsContext, id: string): Promise<CancelJobResult> {
  const jobId = parseJobId(id);
  if (jobId === null) return err("jobs.not_found");
  const now = ctx.clock.now();
  const [row] = await ctx.db
    .update(jobs)
    .set({ status: "cancelled", finishedAt: now, updatedAt: now })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "pending")))
    .returning();
  if (row !== undefined) return ok(toJob(row));
  return (await getJob(ctx, id)) === null ? err("jobs.not_found") : err("jobs.not_cancellable");
}

/**
 * Runs a failed or cancelled job again from scratch: pending, due now, attempts back to 0. Refused with
 * `jobs.dedup_key_taken` while another live job of its queue has the same dedup key.
 */
export async function retryJob(ctx: JobsContext, id: string): Promise<RetryJobResult> {
  const jobId = parseJobId(id);
  if (jobId === null) return err("jobs.not_found");
  const now = ctx.clock.now();
  try {
    const [row] = await ctx.db
      .update(jobs)
      .set({ status: "pending", attempts: 0, runAt: now, finishedAt: null, updatedAt: now })
      .where(and(eq(jobs.id, jobId), inArray(jobs.status, ["failed", "cancelled"])))
      .returning();
    if (row !== undefined) return ok(toJob(row));
  } catch (error) {
    if (isConstraintViolation(error, { code: UNIQUE_VIOLATION, constraint: "jobs_dedup_key_idx" })) return err("jobs.dedup_key_taken");
    throw error;
  }
  return (await getJob(ctx, id)) === null ? err("jobs.not_found") : err("jobs.not_retryable");
}
