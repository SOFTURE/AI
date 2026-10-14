// Claiming and the fenced writes of a claimed job. Every write after the claim names the claim token, so a worker
// whose job was taken over (its lease ended) or released cannot record anything for the newer claim.
import { and, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type { Job } from "../contract.js";
import { jobs } from "../schema.js";
import type { JobsContext } from "./context.js";
import { toJob } from "./job-row.js";
import { getJobsOptions, getQueue } from "./options.js";

/** A job this worker holds: the job and the token its writes are fenced with. */
export interface ClaimedJob {
  readonly job: Job;
  readonly claimToken: string;
}

export interface ClaimJobsInput {
  readonly queue: string;
  /** At most this many jobs. */
  readonly limit: number;
  /** Who claims, stored in `locked_by` for inspection: host and process, e.g. `worker-1:4211`. */
  readonly workerId: string;
}

/** What a finished attempt records. */
export type Completion =
  | { readonly kind: "succeeded" }
  | { readonly kind: "retry"; readonly error: string; readonly runAt: Date }
  | { readonly kind: "failed"; readonly error: string };

const LEASE_EXPIRED = "jobs.lease_expired";

/**
 * Claims up to `limit` due jobs of one queue, oldest due first: pending jobs whose `run_at` has come and running jobs
 * whose lease ended (their worker died). Each claim counts as an attempt. A job whose lease ended with no attempts
 * left is failed with `jobs.lease_expired` instead. Rows another worker is claiming at the same moment are skipped
 * (`FOR UPDATE SKIP LOCKED`), so workers never wait on each other.
 */
export async function claimJobs(ctx: JobsContext, input: ClaimJobsInput): Promise<ClaimedJob[]> {
  const queue = getQueue(getJobsOptions(ctx.config), input.queue);
  if (input.limit < 1) return [];
  const now = ctx.clock.now();
  await failExhaustedLeases(ctx, input.queue, now);

  const due = ctx.db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.queue, input.queue),
        or(
          and(eq(jobs.status, "pending"), lte(jobs.runAt, now)),
          and(eq(jobs.status, "running"), lte(jobs.lockedUntil, now), sql`${jobs.attempts} < ${jobs.maxAttempts}`),
        ),
      ),
    )
    .orderBy(asc(jobs.runAt), asc(jobs.id))
    .limit(input.limit)
    .for("update", { skipLocked: true });

  const rows = await ctx.db
    .update(jobs)
    .set({
      status: "running",
      attempts: sql`${jobs.attempts} + 1`,
      lockedUntil: new Date(now.getTime() + queue.leaseSeconds * 1000),
      lockedBy: input.workerId,
      claimToken: sql`gen_random_uuid()`,
      updatedAt: now,
    })
    .where(inArray(jobs.id, due))
    .returning();

  return rows
    .sort((left, right) => left.runAt.getTime() - right.runAt.getTime() || Number(left.id - right.id))
    .map((row) => ({ job: toJob(row), claimToken: requireToken(row.claimToken) }));
}

/** Pushes the lease of a held job forward. False when the job is no longer this claim's: stop working on it. */
export async function extendJobLease(ctx: JobsContext, claimed: ClaimedJob): Promise<boolean> {
  const queue = getQueue(getJobsOptions(ctx.config), claimed.job.queue);
  const now = ctx.clock.now();
  const rows = await ctx.db
    .update(jobs)
    .set({ lockedUntil: new Date(now.getTime() + queue.leaseSeconds * 1000), updatedAt: now })
    .where(isHeld(claimed))
    .returning();
  return rows.length > 0;
}

/** Records the end of an attempt. False when the job is no longer this claim's: nothing was written. */
export async function completeJob(ctx: JobsContext, claimed: ClaimedJob, completion: Completion): Promise<boolean> {
  const now = ctx.clock.now();
  const unlocked = { lockedUntil: null, lockedBy: null, claimToken: null, updatedAt: now };
  const set =
    completion.kind === "succeeded"
      ? { ...unlocked, status: "succeeded" as const, finishedAt: now, lastError: null }
      : completion.kind === "retry"
        ? { ...unlocked, status: "pending" as const, runAt: completion.runAt, lastError: completion.error }
        : { ...unlocked, status: "failed" as const, finishedAt: now, lastError: completion.error };
  const rows = await ctx.db.update(jobs).set(set).where(isHeld(claimed)).returning();
  return rows.length > 0;
}

/**
 * Gives a held job back without an outcome (the worker is stopping): pending again, due now, and the attempt is not
 * counted. False when the job is no longer this claim's.
 */
export async function releaseJob(ctx: JobsContext, claimed: ClaimedJob): Promise<boolean> {
  const now = ctx.clock.now();
  const rows = await ctx.db
    .update(jobs)
    .set({
      status: "pending",
      attempts: sql`${jobs.attempts} - 1`,
      runAt: now,
      lockedUntil: null,
      lockedBy: null,
      claimToken: null,
      updatedAt: now,
    })
    .where(isHeld(claimed))
    .returning();
  return rows.length > 0;
}

async function failExhaustedLeases(ctx: JobsContext, queue: string, now: Date): Promise<void> {
  await ctx.db
    .update(jobs)
    .set({
      status: "failed",
      lastError: LEASE_EXPIRED,
      finishedAt: now,
      lockedUntil: null,
      lockedBy: null,
      claimToken: null,
      updatedAt: now,
    })
    .where(and(eq(jobs.queue, queue), eq(jobs.status, "running"), lte(jobs.lockedUntil, now), gte(jobs.attempts, jobs.maxAttempts)));
}

function isHeld(claimed: ClaimedJob) {
  return and(eq(jobs.id, BigInt(claimed.job.id)), eq(jobs.status, "running"), eq(jobs.claimToken, claimed.claimToken));
}

function requireToken(token: string | null): string {
  if (token === null) throw new Error("@softure-ai/jobs: a claimed job has no claim token");
  return token;
}
