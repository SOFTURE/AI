// One bounded round of the worker for a host without a long-running process (a Cloudflare Workers Cron Trigger,
// docs/07-runtime-providers.md): enqueue due schedules, report schedule health, claim and run due jobs under their
// leases until nothing is due or the time budget ends, wait for what still runs, prune once an hour and write a
// heartbeat row. Overlapping ticks are safe: schedule slots, claims and completions are transactional and fenced.
import { systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { getConfiguredDatabase } from "@softure-ai/db/request";
import { eq, isNull, lte, or } from "drizzle-orm";
import type { JobHandlers } from "../handlers.js";
import { workerHeartbeats } from "../schema.js";
import { claimJobs } from "./claim.js";
import type { JobsContext } from "./context.js";
import { createDatabaseOutage } from "./database-outage.js";
import { checkHandlers } from "./handler-check.js";
import { startLeasedRun, type LeasedRun } from "./leased-run.js";
import { consoleJobsLogger, type JobsLogger } from "./logger.js";
import { getJobsOptions, getQueue } from "./options.js";
import { checkRoundScheduleStates, enqueueRoundSchedules, pruneRound } from "./round.js";
import { getScheduleNames } from "./schedules.js";

/** Claiming stops after this long; a Cron Trigger fires every minute, so most ticks end before the next one. */
export const DEFAULT_JOBS_TICK_BUDGET_MS = 45_000;
/** The heartbeat row of a tick that names none. */
export const DEFAULT_JOBS_TICK_WORKER = "tick";
/** Three missed one-minute ticks. */
export const DEFAULT_JOBS_TICK_HEALTH_MAX_AGE_MS = 3 * 60 * 1000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

export interface RunJobsTickOptions {
  readonly config: SoftureConfig;
  readonly handlers: JobHandlers;
  /** The database; default the config's (`getConfiguredDatabase`), the request's handle inside `withRequestDatabase`. */
  readonly db?: Queryable;
  /** Only these queues; default every configured queue with a handler. */
  readonly queues?: readonly string[];
  /** How long the tick claims new jobs; default 45 000. Jobs it started still run to their end. */
  readonly budgetMs?: number;
  readonly logger?: JobsLogger;
  readonly clock?: Clock;
  /** The heartbeat row (`jobs.worker_heartbeats`) and the prefix of `locked_by`; default `tick`. */
  readonly workerName?: string;
  /** Stored in `locked_by`; default `<workerName>:<start time>`. */
  readonly runId?: string;
  /** In [0, 1): the jitter of retry delays. */
  readonly random?: () => number;
  /** How often a running job's lease is extended; default a third of the queue's `leaseSeconds`. */
  readonly heartbeatMs?: number;
}

export interface RunJobsTickReport {
  /** Jobs this tick claimed (and ran). */
  readonly claimed: number;
  /** Jobs still running when the budget ended; each was logged as `warn` and ran to its end. */
  readonly pastBudget: number;
  /** Whether this tick pruned (at most one tick an hour per worker name does). */
  readonly isPruned: boolean;
  /** Whether every claim reached the database; only then the heartbeat is written. */
  readonly isHealthy: boolean;
}

/**
 * Runs one tick and resolves with what it did once every job it started has settled. Throws before claiming on a
 * handler for an unknown queue or when no queue has a handler; database failures are logged as `error` and end the
 * claiming, and the next tick tries again.
 */
export async function runJobsTick(options: RunJobsTickOptions): Promise<RunJobsTickReport> {
  const jobsOptions = getJobsOptions(options.config);
  const queues = checkHandlers(jobsOptions, options.handlers, options.queues);
  if (queues.length === 0) {
    throw new Error("@softure-ai/jobs: the tick has no queue to run; pass a handler for at least one configured queue");
  }
  const db = options.db ?? (await openConfiguredDatabase(options.config));
  const clock = options.clock ?? systemClock;
  const ctx: JobsContext = { db, clock, config: options.config };
  const logger = options.logger ?? consoleJobsLogger;
  // A tick has no outage to wait out: every database failure is an error.
  const outage = createDatabaseOutage({ clock, logger, toleranceMs: 0 });
  const roundOptions = { logger, outage };
  const workerName = options.workerName ?? DEFAULT_JOBS_TICK_WORKER;
  const startedAt = clock.now().getTime();
  const runId = options.runId ?? `${workerName}:${new Date(startedAt).toISOString()}`;
  const budgetMs = options.budgetMs ?? DEFAULT_JOBS_TICK_BUDGET_MS;
  const deadline = startedAt + budgetMs;
  const random = options.random ?? Math.random;

  await enqueueRoundSchedules(ctx, getScheduleNames(jobsOptions, queues), new Map(), roundOptions);
  await checkRoundScheduleStates(ctx, roundOptions);

  const running = new Map<string, Set<LeasedRun>>(queues.map((queue) => [queue, new Set()]));
  const countRunning = () => [...running.values()].reduce((sum, slots) => sum + slots.size, 0);
  const wakeUp = createWakeUp();
  let claimedCount = 0;
  let isClaimFailed = false;
  while (clock.now().getTime() < deadline) {
    let hasClaimed = false;
    for (const queue of queues) {
      const slots = running.get(queue) ?? new Set<LeasedRun>();
      const free = getQueue(jobsOptions, queue).concurrency - slots.size;
      if (free <= 0) continue;
      try {
        const claimed = await claimJobs(ctx, { queue, limit: free, workerId: runId, logger, random });
        outage.recover();
        for (const job of claimed) {
          slots.add(
            startLeasedRun(ctx, job, {
              handlers: options.handlers,
              logger,
              outage,
              random,
              ...(options.heartbeatMs === undefined ? {} : { heartbeatMs: options.heartbeatMs }),
              onSettled: (run) => {
                slots.delete(run);
                wakeUp.wake();
              },
            }),
          );
        }
        claimedCount += claimed.length;
        hasClaimed ||= claimed.length > 0;
      } catch (error) {
        isClaimFailed = true;
        outage.fail("could not claim jobs; the next tick tries again", { queue, error });
        break;
      }
    }
    if (isClaimFailed || (!hasClaimed && countRunning() === 0)) break;
    const remainingMs = deadline - clock.now().getTime();
    if (remainingMs <= 0) break;
    await wakeUp.wait(Math.min(jobsOptions.pollIntervalMs, remainingMs));
  }

  const pastBudget = clock.now().getTime() >= deadline ? [...running.values()].flatMap((slots) => [...slots]) : [];
  for (const run of pastBudget) {
    logger.warn("job runs past the tick's budget; it keeps its lease until it ends or the platform stops the tick", {
      queue: run.claimed.job.queue,
      jobId: run.claimed.job.id,
      budgetMs,
    });
  }
  await Promise.all([...running.values()].flatMap((slots) => [...slots].map((run) => run.done)));

  const isPruned = await claimPrune(ctx, workerName, outage);
  if (isPruned) await pruneRound(ctx, roundOptions);
  if (!isClaimFailed) await beat(ctx, workerName, outage);
  return { claimed: claimedCount, pastBudget: pastBudget.length, isPruned, isHealthy: !isClaimFailed };
}

export type JobsTickHealth = { ok: true; ageMs: number } | { ok: false; reason: "missing" } | { ok: false; reason: "stale"; ageMs: number };

export interface CheckJobsTickHealthInput {
  /** Default `tick`. */
  readonly workerName?: string;
  /** The oldest heartbeat that still counts; default three minutes (three missed one-minute ticks). */
  readonly maxAgeMs?: number;
}

/** Whether the tick's heartbeat row exists and is no older than `maxAgeMs`. Reads one row. */
export async function checkJobsTickHealth(ctx: JobsContext, input: CheckJobsTickHealthInput = {}): Promise<JobsTickHealth> {
  const [row] = await ctx.db
    .select({ beatAt: workerHeartbeats.beatAt })
    .from(workerHeartbeats)
    .where(eq(workerHeartbeats.workerId, input.workerName ?? DEFAULT_JOBS_TICK_WORKER))
    .limit(1);
  if (row?.beatAt === undefined || row.beatAt === null) return { ok: false, reason: "missing" };
  const ageMs = Math.max(0, ctx.clock.now().getTime() - row.beatAt.getTime());
  const maxAgeMs = input.maxAgeMs ?? DEFAULT_JOBS_TICK_HEALTH_MAX_AGE_MS;
  return ageMs > maxAgeMs ? { ok: false, reason: "stale", ageMs } : { ok: true, ageMs };
}

async function openConfiguredDatabase(config: SoftureConfig): Promise<Queryable> {
  if (config.database === null) throw new Error("@softure-ai/jobs: the config has no database; set database.url in softure.config");
  return (await getConfiguredDatabase(config.database)).db;
}

/** Takes this hour's prune for `workerName` with a conditional upsert, so overlapping ticks prune once. */
async function claimPrune(ctx: JobsContext, workerName: string, outage: ReturnType<typeof createDatabaseOutage>): Promise<boolean> {
  const now = ctx.clock.now();
  try {
    const taken = await ctx.db
      .insert(workerHeartbeats)
      .values({ workerId: workerName, prunedAt: now })
      .onConflictDoUpdate({
        target: workerHeartbeats.workerId,
        set: { prunedAt: now },
        setWhere: or(isNull(workerHeartbeats.prunedAt), lte(workerHeartbeats.prunedAt, new Date(now.getTime() - PRUNE_INTERVAL_MS))),
      })
      .returning({ workerId: workerHeartbeats.workerId });
    outage.recover();
    return taken.length > 0;
  } catch (error) {
    outage.fail("could not take the hourly prune", { error });
    return false;
  }
}

async function beat(ctx: JobsContext, workerName: string, outage: ReturnType<typeof createDatabaseOutage>): Promise<void> {
  const now = ctx.clock.now();
  try {
    await ctx.db
      .insert(workerHeartbeats)
      .values({ workerId: workerName, beatAt: now })
      .onConflictDoUpdate({ target: workerHeartbeats.workerId, set: { beatAt: now } });
    outage.recover();
  } catch (error) {
    outage.fail("could not write the tick's heartbeat", { error });
  }
}

/** A sleep that a finished job cuts short. */
function createWakeUp(): { wake: () => void; wait: (ms: number) => Promise<void> } {
  let pending: (() => void) | undefined;
  let isWoken = false;
  return {
    wake: () => {
      isWoken = true;
      pending?.();
    },
    wait: (ms) =>
      new Promise<void>((resolve) => {
        if (isWoken) {
          isWoken = false;
          resolve();
          return;
        }
        const finish = () => {
          clearTimeout(timer);
          pending = undefined;
          isWoken = false;
          resolve();
        };
        const timer = setTimeout(finish, ms);
        pending = finish;
      }),
  };
}
