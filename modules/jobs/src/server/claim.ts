// Claiming and the fenced writes of a claimed job. Every write after the claim names the claim token, so a worker
// whose job was taken over (its lease ended) or released cannot record anything for the newer claim.
import type { Queryable } from "@softure-ai/db";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { Job, JobFailedEvent, QueuePausedEvent } from "../contract.js";
import type { JobQueueOptions } from "../options.js";
import { jobs, type JobRow } from "../schema.js";
import type { JobsContext } from "./context.js";
import { notifyJobFailed, notifyQueuePaused, type HookOptions } from "./hooks.js";
import { toJob } from "./job-row.js";
import { getJobsOptions, getQueue } from "./options.js";
import { getQueuePause, lockPacedBudget, pauseQueueForHandler, recordBreakerOutcome, type BreakerOutcome } from "./queue-state.js";
import { recordRuns, type RunRecord } from "./runs.js";
import { consoleJobsLogger } from "./logger.js";
import { logRunEnd } from "./run-log.js";
import { recordScheduleFailure, recordScheduleSuccess } from "./schedules.js";
import { JOB_CANCELLED_CODE, type JobProgress } from "../progress.js";
import type { JobRunSummary } from "../summary.js";

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
  /** Where a failing `onJobFailed` hook is logged; default the console logger. */
  readonly logger?: HookOptions["logger"];
  /** In [0, 1): the jitter of a `rateLimit` gap; default `Math.random`. */
  readonly random?: () => number;
}

/** What a finished attempt records. */
export type Completion =
  /** `summary`: the handler's checked run summary, kept in the run history. */
  | { readonly kind: "succeeded"; readonly summary?: JobRunSummary | null }
  | { readonly kind: "retry"; readonly error: string; readonly runAt: Date }
  /** `isPermanent`: the job's own fault (`failJob`, an invalid payload), which the queue's breaker does not count. */
  | { readonly kind: "failed"; readonly error: string; readonly isPermanent?: boolean }
  /** `pauseQueueLater`: the queue pauses for `seconds`; the job gets its attempt back and is due at `runAt`, the pause's end. */
  | { readonly kind: "paused"; readonly error: string; readonly seconds: number; readonly runAt: Date }
  /** An operator cancelled the job (`requestJobCancel`): `cancelled`, not retried, no `onJobFailed`. */
  | { readonly kind: "cancelled" };

/**
 * What a heartbeat or a progress write found: the job is still this claim's, it is and an operator asked it to stop,
 * or it is no longer this claim's.
 */
export type JobHeartbeat = "held" | "cancel_requested" | "lost";

const LEASE_EXPIRED = "jobs.lease_expired";

/**
 * Claims up to `limit` due jobs of one queue, oldest due first: pending jobs whose `run_at` has come and running jobs
 * whose lease ended (their worker died). Each claim counts as an attempt. A job whose lease ended with no attempts
 * left is failed with `jobs.lease_expired` instead (and `onJobFailed` runs for it); one an operator asked to stop is
 * `cancelled`. Rows another worker is claiming at the same moment are skipped (`FOR UPDATE SKIP LOCKED`), so workers
 * never wait on each other. A claim clears the progress of the previous attempt. A paused queue claims nothing. A
 * queue with `rateLimit` claims within its budget, holding its `queue_state` row for the claim, so every worker shares
 * it. Jobs held back keep their attempts.
 */
export async function claimJobs(ctx: JobsContext, input: ClaimJobsInput): Promise<ClaimedJob[]> {
  const queue = getQueue(getJobsOptions(ctx.config), input.queue);
  if (input.limit < 1) return [];
  const now = ctx.clock.now();
  await cancelAbandonedJobs(ctx, input.queue, now);
  const expired = await failExhaustedLeases(ctx, input.queue, now);
  const { logRuns } = getJobsOptions(ctx.config);
  for (const event of expired) {
    logRunEnd(input.logger ?? consoleJobsLogger, logRuns, { outcome: "failed", queue: event.queue, jobId: event.jobId, attempt: event.attempts, code: event.code });
  }
  await notifyJobFailed(ctx, expired, { logger: input.logger });

  const random = input.random ?? Math.random;
  let rows: JobRow[];
  if (queue.rateLimit === undefined) {
    // An unpaced queue never waits on the state row: one read of the pause.
    rows = (await getQueuePause(ctx, input.queue)) === null ? await claimDue(ctx.db, { queue: input.queue, options: queue, workerId: input.workerId, now, limit: input.limit }) : [];
  } else {
    const { rateLimit } = queue;
    rows = await ctx.db.transaction(async (tx) => {
      const budget = await lockPacedBudget(tx, { queue: input.queue, rateLimit, limit: input.limit, now, random });
      if (budget.allowed === 0) return [];
      const claimed = await claimDue(tx, { queue: input.queue, options: queue, workerId: input.workerId, now, limit: budget.allowed });
      await budget.spend(claimed.length);
      return claimed;
    });
  }

  return rows
    .sort((left, right) => left.runAt.getTime() - right.runAt.getTime() || Number(left.id - right.id))
    .map((row) => ({ job: toJob(row), claimToken: requireToken(row.claimToken) }));
}

/** Claims up to `limit` due jobs of one queue in one statement; rows other workers are claiming are skipped. */
async function claimDue(
  db: Queryable,
  input: { readonly queue: string; readonly options: JobQueueOptions; readonly workerId: string; readonly now: Date; readonly limit: number },
): Promise<JobRow[]> {
  const { now } = input;
  const due = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.queue, input.queue),
        or(
          and(eq(jobs.status, "pending"), lte(jobs.runAt, now)),
          and(eq(jobs.status, "running"), lte(jobs.lockedUntil, now), sql`${jobs.attempts} < ${jobs.maxAttempts}`, isNull(jobs.cancelRequestedAt)),
        ),
      ),
    )
    .orderBy(asc(jobs.runAt), asc(jobs.id))
    .limit(input.limit)
    .for("update", { skipLocked: true });

  return db
    .update(jobs)
    .set({
      status: "running",
      attempts: sql`${jobs.attempts} + 1`,
      lockedUntil: new Date(now.getTime() + input.options.leaseSeconds * 1000),
      lockedBy: input.workerId,
      claimToken: sql`gen_random_uuid()`,
      progress: null,
      progressAt: null,
      updatedAt: now,
    })
    .where(inArray(jobs.id, due))
    .returning();
}

/** Pushes the lease of a held job forward. False when the job is no longer this claim's: stop working on it. */
export async function extendJobLease(ctx: JobsContext, claimed: ClaimedJob): Promise<boolean> {
  return (await heartbeatJob(ctx, claimed)) !== "lost";
}

/**
 * Pushes the lease of a held job forward and tells whether an operator asked it to stop (`requestJobCancel`): the
 * worker then aborts the handler's signal with a `JobCancelledError`. `lost` when the job is no longer this claim's.
 */
export async function heartbeatJob(ctx: JobsContext, claimed: ClaimedJob): Promise<JobHeartbeat> {
  const queue = getQueue(getJobsOptions(ctx.config), claimed.job.queue);
  const now = ctx.clock.now();
  const rows = await ctx.db
    .update(jobs)
    .set({ lockedUntil: new Date(now.getTime() + queue.leaseSeconds * 1000), updatedAt: now })
    .where(isHeld(claimed))
    .returning({ cancelRequestedAt: jobs.cancelRequestedAt });
  return toHeartbeat(rows);
}

/**
 * Stores a checked progress on a held job (fenced like every write of a claim). Tells, like a heartbeat, whether an
 * operator asked the job to stop.
 */
export async function writeJobProgress(ctx: JobsContext, claimed: ClaimedJob, progress: JobProgress): Promise<JobHeartbeat> {
  const now = ctx.clock.now();
  const rows = await ctx.db
    .update(jobs)
    .set({ progress, progressAt: now })
    .where(isHeld(claimed))
    .returning({ cancelRequestedAt: jobs.cancelRequestedAt });
  return toHeartbeat(rows);
}

function toHeartbeat(rows: readonly { cancelRequestedAt: Date | null }[]): JobHeartbeat {
  const [row] = rows;
  if (row === undefined) return "lost";
  return row.cancelRequestedAt === null ? "held" : "cancel_requested";
}

/**
 * Records the end of an attempt and its row in the run history; a success or a terminal failure of a scheduled queue
 * also updates its schedule, all in the same transaction. After a recorded terminal failure the app's `onJobFailed` hook runs.
 * A retry of a job an operator asked to stop is recorded as `cancelled` instead. False when the job is no longer this
 * claim's: nothing was written.
 */
export async function completeJob(ctx: JobsContext, claimed: ClaimedJob, completion: Completion, options: HookOptions = {}): Promise<boolean> {
  return (await recordCompletion(ctx, claimed, completion, options)) !== null;
}

/** `completeJob` that returns the completion it recorded (a retry may become `cancelled`), or null when it wrote nothing. */
export async function recordCompletion(ctx: JobsContext, claimed: ClaimedJob, requested: Completion, options: HookOptions = {}): Promise<Completion | null> {
  const now = ctx.clock.now();
  const { job } = claimed;
  const breaker = getQueue(getJobsOptions(ctx.config), job.queue).breaker;
  let completion = requested;
  const recorded = await ctx.db.transaction(async (tx) => {
    const [held] = await tx.select({ cancelRequestedAt: jobs.cancelRequestedAt }).from(jobs).where(isHeld(claimed)).for("update");
    if (held === undefined) return null;
    if ((completion.kind === "retry" || completion.kind === "paused") && held.cancelRequestedAt !== null) completion = { kind: "cancelled" };
    const rows = await tx.update(jobs).set(toCompletionSet(completion, now)).where(isHeld(claimed)).returning();
    if (rows.length === 0) return null;
    await recordRuns(tx, [toRunRecord(claimed, completion, now)]);
    if (completion.kind === "succeeded") await recordScheduleSuccess({ ...ctx, db: tx }, job.queue);
    if (completion.kind === "failed") await recordScheduleFailure({ ...ctx, db: tx }, job.queue, completion.error);
    let paused: QueuePausedEvent | null = null;
    if (completion.kind === "paused") {
      paused = await pauseQueueForHandler(tx, { queue: job.queue, code: completion.error, seconds: completion.seconds, now });
    }
    const outcome = toBreakerOutcome(completion);
    if (breaker !== undefined && outcome !== null) paused = await recordBreakerOutcome(tx, { queue: job.queue, breaker, outcome, now });
    return { paused };
  });
  if (recorded === null) return null;
  if (completion.kind === "failed") {
    await notifyJobFailed(ctx, [{ queue: job.queue, jobId: job.id, code: completion.error, attempts: job.attempts, at: now }], options);
  }
  if (recorded.paused !== null) await notifyQueuePaused(ctx, recorded.paused, options);
  return completion;
}

/** What the queue's breaker makes of an attempt: retries and attempt-exhausting failures count, a success resets. */
function toBreakerOutcome(completion: Completion): BreakerOutcome | null {
  if (completion.kind === "succeeded") return { kind: "success" };
  if (completion.kind === "retry") return { kind: "failure", code: completion.error };
  if (completion.kind === "failed" && completion.isPermanent !== true) return { kind: "failure", code: completion.error };
  return null;
}

/**
 * The columns a completion writes. An attempt that ended on its own before its worker saw a cancel request drops the
 * request with the lease; a cancelled job keeps the request's time for inspection. A `pauseQueueLater` attempt gives
 * its attempt back.
 */
function toCompletionSet(completion: Completion, now: Date) {
  const unlocked = { lockedUntil: null, lockedBy: null, claimToken: null, updatedAt: now };
  switch (completion.kind) {
    case "succeeded":
      return { ...unlocked, cancelRequestedAt: null, status: "succeeded" as const, finishedAt: now, lastError: null };
    case "retry":
      return { ...unlocked, cancelRequestedAt: null, status: "pending" as const, runAt: completion.runAt, lastError: completion.error };
    case "paused":
      return {
        ...unlocked,
        cancelRequestedAt: null,
        status: "pending" as const,
        attempts: sql`${jobs.attempts} - 1`,
        runAt: completion.runAt,
        lastError: completion.error,
      };
    case "failed":
      return { ...unlocked, cancelRequestedAt: null, status: "failed" as const, finishedAt: now, lastError: completion.error };
    case "cancelled":
      return { ...unlocked, status: "cancelled" as const, finishedAt: now };
  }
}

/**
 * Gives a held job back without an outcome (the worker is stopping): pending again, due now, and the attempt is not
 * counted. A job an operator asked to stop is `cancelled` instead (its attempt recorded as such). False when the job
 * is no longer this claim's.
 */
export async function releaseJob(ctx: JobsContext, claimed: ClaimedJob): Promise<boolean> {
  const now = ctx.clock.now();
  const [requested] = await ctx.db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(isHeld(claimed), isNotNull(jobs.cancelRequestedAt)))
    .limit(1);
  if (requested !== undefined) return completeJob(ctx, claimed, { kind: "cancelled" });
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
    .where(and(isHeld(claimed), isNull(jobs.cancelRequestedAt)))
    .returning();
  return rows.length > 0;
}

/**
 * Cancels the running jobs of `queue` an operator asked to stop whose lease ended (their worker died before it saw the
 * request): they are never claimed again. Each leaves a `cancelled` run with an unknown start.
 */
async function cancelAbandonedJobs(ctx: JobsContext, queue: string, now: Date): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const cancelled = await tx
      .update(jobs)
      .set({ status: "cancelled", finishedAt: now, lockedUntil: null, lockedBy: null, claimToken: null, updatedAt: now })
      .where(and(eq(jobs.queue, queue), eq(jobs.status, "running"), lte(jobs.lockedUntil, now), isNotNull(jobs.cancelRequestedAt)))
      .returning({ id: jobs.id, attempts: jobs.attempts, origin: jobs.origin });
    await recordRuns(
      tx,
      cancelled.map((row) => ({
        jobId: row.id.toString(),
        queue,
        origin: row.origin,
        attempt: row.attempts,
        outcome: "cancelled" as const,
        errorCode: JOB_CANCELLED_CODE,
        summary: null,
        startedAt: null,
        finishedAt: now,
      })),
    );
  });
}

/** Fails the running jobs of `queue` whose lease ended with no attempts left; returns what `onJobFailed` gets. */
async function failExhaustedLeases(ctx: JobsContext, queue: string, now: Date): Promise<JobFailedEvent[]> {
  return ctx.db.transaction(async (tx) => {
    const failed = await tx
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
      .where(
        and(eq(jobs.queue, queue), eq(jobs.status, "running"), lte(jobs.lockedUntil, now), gte(jobs.attempts, jobs.maxAttempts), isNull(jobs.cancelRequestedAt)),
      )
      .returning({ id: jobs.id, attempts: jobs.attempts, origin: jobs.origin });
    if (failed.length > 0) await recordScheduleFailure({ ...ctx, db: tx }, queue, LEASE_EXPIRED);
    await recordRuns(
      tx,
      failed.map((row) => ({
        jobId: row.id.toString(),
        queue,
        origin: row.origin,
        attempt: row.attempts,
        outcome: "failed" as const,
        errorCode: LEASE_EXPIRED,
        summary: null,
        startedAt: null,
        finishedAt: now,
      })),
    );
    return failed.map((row) => ({ queue, jobId: row.id.toString(), code: LEASE_EXPIRED, attempts: row.attempts, at: now }));
  });
}

/** The run row of a completed attempt. The claim set `updated_at`, so the claimed job's `updatedAt` is its start. */
function toRunRecord(claimed: ClaimedJob, completion: Completion, now: Date): RunRecord {
  const { job } = claimed;
  const base = { jobId: job.id, queue: job.queue, origin: job.origin, attempt: job.attempts, startedAt: job.updatedAt, finishedAt: now };
  if (completion.kind === "succeeded") return { ...base, outcome: "succeeded", errorCode: null, summary: completion.summary ?? null };
  if (completion.kind === "cancelled") return { ...base, outcome: "cancelled", errorCode: JOB_CANCELLED_CODE, summary: null };
  return { ...base, outcome: completion.kind === "failed" ? "failed" : "retried", errorCode: completion.error, summary: null };
}

function isHeld(claimed: ClaimedJob) {
  return and(eq(jobs.id, BigInt(claimed.job.id)), eq(jobs.status, "running"), eq(jobs.claimToken, claimed.claimToken));
}

function requireToken(token: string | null): string {
  if (token === null) throw new Error("@softure-ai/jobs: a claimed job has no claim token");
  return token;
}
