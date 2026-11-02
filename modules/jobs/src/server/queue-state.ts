// Per-queue state shared by every worker (`jobs.queue_state`): the pacing budget of `rateLimit`, the counter of
// `breaker` and a pause. A paced claim holds the queue's row `FOR UPDATE` in its transaction, so two workers cannot
// spend the same budget; the breaker's counter moves in the transaction that records an attempt.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { eq, sql } from "drizzle-orm";
import type { QueuePause, QueuePausedEvent } from "../contract.js";
import type { JobQueueBreaker, JobQueueRateLimit } from "../options.js";
import { queueState, type QueueStateRow } from "../schema.js";
import type { JobsContext } from "./context.js";
import { getJobsOptions } from "./options.js";

const MAX_REASON_LENGTH = 200;

export interface PauseQueueInput {
  /** When the queue runs again; omitted, it stays paused until `resumeQueue`. */
  readonly until?: Date;
  /** Shown on the admin page and in `getQueueStats`: a code or a short reason, never personal data. 1 to 200 characters. */
  readonly reason: string;
}

export type PauseQueueResult = Ok<QueuePause> | Err<"jobs.unknown_queue">;
export type ResumeQueueResult = Ok<null> | Err<"jobs.unknown_queue">;

/** A queue's breaker counter and active pause, as `getQueueStats` reports them. */
export interface QueueStateSummary {
  readonly pause: QueuePause | null;
  readonly consecutiveFailures: number;
}

/**
 * Pauses a queue for an operator: no worker claims its jobs until `until` (or until `resumeQueue` without one), and its
 * jobs keep their attempts. Replaces any pause the queue has. Runs no hook. `jobs.unknown_queue` for a queue the
 * configuration does not define; throws on an empty or too long reason.
 */
export async function pauseQueue(ctx: JobsContext, queue: string, input: PauseQueueInput): Promise<PauseQueueResult> {
  if (!isConfiguredQueue(ctx, queue)) return err("jobs.unknown_queue");
  if (input.reason.length < 1 || input.reason.length > MAX_REASON_LENGTH) {
    throw new RangeError(`@softure-ai/jobs: pauseQueue reason must be 1 to ${String(MAX_REASON_LENGTH)} characters`);
  }
  const now = ctx.clock.now();
  const pause = { pauseSource: "operator" as const, pauseReason: input.reason, pausedUntil: input.until ?? null, updatedAt: now };
  await ctx.db
    .insert(queueState)
    .values({ queue, ...pause, createdAt: now })
    .onConflictDoUpdate({ target: queueState.queue, set: pause });
  return ok({ source: "operator", reason: input.reason, until: input.until ?? null });
}

/**
 * Ends a queue's pause, whoever set it, and resets its breaker (counter and pause growth), so the next failures start
 * from zero. `jobs.unknown_queue` for a queue the configuration does not define.
 */
export async function resumeQueue(ctx: JobsContext, queue: string): Promise<ResumeQueueResult> {
  if (!isConfiguredQueue(ctx, queue)) return err("jobs.unknown_queue");
  await ctx.db
    .update(queueState)
    .set({ pauseSource: null, pauseReason: null, pausedUntil: null, consecutiveFailures: 0, lastPauseSeconds: null, updatedAt: ctx.clock.now() })
    .where(eq(queueState.queue, queue));
  return ok(null);
}

/** The queue's active pause, or null. */
export async function getQueuePause(ctx: JobsContext, queue: string): Promise<QueuePause | null> {
  const [row] = await ctx.db.select().from(queueState).where(eq(queueState.queue, queue)).limit(1);
  return row === undefined ? null : toActivePause(row, ctx.clock.now());
}

/** Every queue's state that has a row, by queue name. */
export async function getQueueStateSummaries(ctx: JobsContext): Promise<Map<string, QueueStateSummary>> {
  const now = ctx.clock.now();
  const rows = await ctx.db.select().from(queueState);
  return new Map(rows.map((row) => [row.queue, { pause: toActivePause(row, now), consecutiveFailures: row.consecutiveFailures }]));
}

/** What a paced claim may take and how to record it. */
export interface PacedBudget {
  /** Jobs the claim may take now; 0 while the queue is paused or its budget is spent. */
  readonly allowed: number;
  /** Records that `claimed` jobs were taken. */
  readonly spend: (claimed: number) => Promise<void>;
}

/**
 * Locks the queue's row for the caller's transaction (`db` must be one) and returns its budget: 0 while paused, else
 * what `rateLimit` leaves of `limit`.
 */
export async function lockPacedBudget(
  db: Queryable,
  input: { readonly queue: string; readonly rateLimit: JobQueueRateLimit | undefined; readonly limit: number; readonly now: Date; readonly random: () => number },
): Promise<PacedBudget> {
  const { queue, rateLimit, now } = input;
  const row = await lockRow(db, queue, now);
  const idle: PacedBudget = { allowed: 0, spend: () => Promise.resolve() };
  if (toActivePause(row, now) !== null) return idle;
  if (rateLimit === undefined) return { allowed: input.limit, spend: () => Promise.resolve() };

  if ("minGapMs" in rateLimit) {
    if (row.nextAllowedAt !== null && row.nextAllowedAt.getTime() > now.getTime()) return idle;
    return {
      allowed: Math.min(input.limit, 1),
      spend: async (claimed) => {
        if (claimed === 0) return;
        const gapMs = rateLimit.minGapMs + Math.floor(clampUnit(input.random()) * rateLimit.jitterMs);
        await db.update(queueState).set({ nextAllowedAt: new Date(now.getTime() + gapMs), updatedAt: now }).where(eq(queueState.queue, queue));
      },
    };
  }

  const isWindowOver = row.windowStartedAt === null || now.getTime() >= row.windowStartedAt.getTime() + rateLimit.perSeconds * 1000;
  const spent = isWindowOver ? 0 : row.windowCount;
  return {
    allowed: Math.max(Math.min(input.limit, rateLimit.max - spent), 0),
    spend: async (claimed) => {
      if (claimed === 0) return;
      const set = isWindowOver ? { windowStartedAt: now, windowCount: claimed } : { windowCount: spent + claimed };
      await db.update(queueState).set({ ...set, updatedAt: now }).where(eq(queueState.queue, queue));
    },
  };
}

/** How one recorded attempt moves the breaker: a success, a failure it counts, or neither. */
export type BreakerOutcome = { readonly kind: "success" } | { readonly kind: "failure"; readonly code: string };

/**
 * Moves the breaker of a queue in the caller's transaction. A counted failure adds one; at `failures` in a row the
 * queue pauses for `pauseSeconds`; a counted failure after a breaker pause and before a success pauses it again for
 * twice the last pause, up to `maxPauseSeconds`. A failure while a pause is active only counts (jobs that were running
 * when the queue paused). A success resets the counter and the growth. Returns the pause it started, or null.
 */
export async function recordBreakerOutcome(
  db: Queryable,
  input: { readonly queue: string; readonly breaker: JobQueueBreaker; readonly outcome: BreakerOutcome; readonly now: Date },
): Promise<QueuePausedEvent | null> {
  const { queue, breaker, outcome, now } = input;
  if (outcome.kind === "success") {
    await db
      .update(queueState)
      .set({ consecutiveFailures: 0, lastPauseSeconds: null, updatedAt: now })
      .where(sql`${queueState.queue} = ${queue} AND (${queueState.consecutiveFailures} > 0 OR ${queueState.lastPauseSeconds} IS NOT NULL)`);
    return null;
  }
  if (breaker.codes !== undefined && !breaker.codes.includes(outcome.code)) return null;

  const row = await lockRow(db, queue, now);
  const failures = row.consecutiveFailures + 1;
  let seconds: number | null = null;
  if (toActivePause(row, now) === null) {
    if (row.lastPauseSeconds !== null) seconds = Math.min(row.lastPauseSeconds * 2, breaker.maxPauseSeconds);
    else if (failures >= breaker.failures) seconds = breaker.pauseSeconds;
  }
  if (seconds === null) {
    await db.update(queueState).set({ consecutiveFailures: failures, updatedAt: now }).where(eq(queueState.queue, queue));
    return null;
  }
  const until = new Date(now.getTime() + seconds * 1000);
  await db
    .update(queueState)
    .set({ consecutiveFailures: failures, lastPauseSeconds: seconds, pauseSource: "breaker", pauseReason: outcome.code, pausedUntil: until, updatedAt: now })
    .where(eq(queueState.queue, queue));
  return { queue, code: outcome.code, until, source: "breaker", at: now };
}

/**
 * Pauses a queue for a handler's refusal (`pauseQueueLater`) in the caller's transaction. Never shortens an active
 * pause and never replaces an operator's: then nothing changes and it returns null.
 */
export async function pauseQueueForHandler(
  db: Queryable,
  input: { readonly queue: string; readonly code: string; readonly seconds: number; readonly now: Date },
): Promise<QueuePausedEvent | null> {
  const { queue, code, now } = input;
  const until = new Date(now.getTime() + input.seconds * 1000);
  const row = await lockRow(db, queue, now);
  const active = toActivePause(row, now);
  if (active !== null && (active.until === null || active.until.getTime() >= until.getTime())) return null;
  await db.update(queueState).set({ pauseSource: "handler", pauseReason: code, pausedUntil: until, updatedAt: now }).where(eq(queueState.queue, queue));
  return { queue, code, until, source: "handler", at: now };
}

async function lockRow(db: Queryable, queue: string, now: Date): Promise<QueueStateRow> {
  await db.insert(queueState).values({ queue, createdAt: now, updatedAt: now }).onConflictDoNothing();
  const [row] = await db.select().from(queueState).where(eq(queueState.queue, queue)).for("update");
  // The insert above guarantees the row; a missing one means the table changed under the module.
  if (row === undefined) throw new Error(`@softure-ai/jobs: the state row of queue "${queue}" is missing`);
  return row;
}

function toActivePause(row: QueueStateRow, now: Date): QueuePause | null {
  if (row.pauseSource === null || row.pauseReason === null) return null;
  if (row.pausedUntil !== null && row.pausedUntil.getTime() <= now.getTime()) return null;
  return { source: row.pauseSource, reason: row.pauseReason, until: row.pausedUntil };
}

function isConfiguredQueue(ctx: JobsContext, queue: string): boolean {
  return Object.hasOwn(getJobsOptions(ctx.config).queues, queue);
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1 - Number.EPSILON) : 0;
}
