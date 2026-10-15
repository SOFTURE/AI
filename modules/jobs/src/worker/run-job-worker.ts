// The worker loop: enqueues the due runs of the schedules among its queues, claims due jobs of every queue it has a
// handler for, up to each queue's concurrency, runs them, keeps their leases alive, prunes old jobs once an hour, and
// on abort stops claiming, waits the grace period and releases what is still running.
import { hostname } from "node:os";
import { systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import type { JobHandlers } from "../handlers.js";
import { claimJobs, extendJobLease, releaseJob, type ClaimedJob } from "../server/claim.js";
import type { JobsContext } from "../server/context.js";
import { checkHandlers } from "../server/handler-check.js";
import { consoleJobsLogger, type JobsLogger } from "../server/logger.js";
import { pruneJobs } from "../server/maintenance.js";
import { getJobsOptions, getQueue } from "../server/options.js";
import { runClaimedJob } from "../server/process.js";
import { enqueueScheduledRun, getSchedule, getScheduleNames, getScheduleSlot } from "../server/schedules.js";

const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
/** A lease is extended three times per lease period, so one slow write does not lose it. */
const HEARTBEATS_PER_LEASE = 3;

export interface RunJobWorkerOptions {
  /** The worker's own database handle (`openCommandDatabase`), with a pool of at least the summed concurrency + 1. */
  readonly db: Queryable;
  readonly config: SoftureConfig;
  readonly handlers: JobHandlers;
  /** Abort to stop: no new claims, running jobs get `shutdownGraceMs`, then they are released. */
  readonly signal: AbortSignal;
  /** Only these queues; default every configured queue with a handler. */
  readonly queues?: readonly string[];
  readonly logger?: JobsLogger;
  readonly clock?: Clock;
  /** Stored in `locked_by`; default `<hostname>:<pid>`. */
  readonly workerId?: string;
  /** In [0, 1): the jitter of retry delays. */
  readonly random?: () => number;
  /** How often a running job's lease is extended; default a third of the queue's `leaseSeconds`. */
  readonly heartbeatMs?: number;
}

interface RunningJob {
  readonly claimed: ClaimedJob;
  readonly controller: AbortController;
  readonly done: Promise<void>;
}

/**
 * Runs until `signal` aborts, then resolves once every job finished or was released. Throws before starting on a
 * handler for an unknown queue or when no queue has a handler. Database failures while claiming or recording are
 * logged and retried on the next round: a database restart does not end the worker.
 */
export async function runJobWorker(options: RunJobWorkerOptions): Promise<void> {
  const jobsOptions = getJobsOptions(options.config);
  const queues = checkHandlers(jobsOptions, options.handlers, options.queues);
  if (queues.length === 0) {
    throw new Error("@softure-ai/jobs: the worker has no queue to run; pass a handler for at least one configured queue");
  }
  const logger = options.logger ?? consoleJobsLogger;
  const ctx: JobsContext = { db: options.db, clock: options.clock ?? systemClock, config: options.config };
  const workerId = options.workerId ?? `${hostname()}:${String(process.pid)}`;
  const random = options.random ?? Math.random;
  const running = new Map<string, Set<RunningJob>>(queues.map((queue) => [queue, new Set()]));
  const wakeUp = createWakeUp();
  let lastPruneAt = Number.NEGATIVE_INFINITY;
  // Per schedule, the latest period this worker already settled (enqueued, or found taken), so it writes once per period.
  const settledSlots = new Map<string, number>();
  const scheduleNames = getScheduleNames(jobsOptions, queues);

  const idle = Object.keys(jobsOptions.queues).filter((queue) => !queues.includes(queue));
  if (idle.length > 0 && options.queues === undefined) {
    logger.warn("configured queues without a handler are not run by this worker", { queues: idle.join(", ") });
  }
  logger.info("worker started", { workerId, queues: queues.join(", ") });

  const start = (claimed: ClaimedJob): RunningJob => {
    const controller = new AbortController();
    const heartbeatMs = options.heartbeatMs ?? (getQueue(jobsOptions, claimed.job.queue).leaseSeconds * 1000) / HEARTBEATS_PER_LEASE;
    const heartbeat = setInterval(() => {
      extendJobLease(ctx, claimed).then(
        (isHeld) => {
          if (!isHeld && !controller.signal.aborted) {
            logger.warn("job lease lost; its handler is aborted", { queue: claimed.job.queue, jobId: claimed.job.id });
            controller.abort();
          }
        },
        (error: unknown) => logger.error("could not extend a job lease", { queue: claimed.job.queue, jobId: claimed.job.id, error }),
      );
    }, heartbeatMs);
    const done = runClaimedJob(ctx, claimed, { handlers: options.handlers, logger, signal: controller.signal, random })
      .then(
        (outcome) => {
          if (outcome.kind === "stale") logger.warn("job outcome not recorded: the job was taken over or released", { queue: claimed.job.queue, jobId: claimed.job.id });
        },
        (error: unknown) => logger.error("could not record a job outcome; it runs again when its lease ends", { queue: claimed.job.queue, jobId: claimed.job.id, error }),
      )
      .finally(() => {
        clearInterval(heartbeat);
        running.get(claimed.job.queue)?.delete(entry);
        wakeUp.wake();
      });
    const entry: RunningJob = { claimed, controller, done };
    return entry;
  };

  while (!options.signal.aborted) {
    for (const name of scheduleNames) {
      const slot = getScheduleSlot(getSchedule(jobsOptions, name), ctx.clock.now());
      if ((settledSlots.get(name) ?? Number.NEGATIVE_INFINITY) >= slot.getTime()) continue;
      try {
        const isEnqueued = await enqueueScheduledRun(ctx, name, slot);
        settledSlots.set(name, slot.getTime());
        if (isEnqueued) logger.info("scheduled run enqueued", { queue: name, slot: slot.toISOString() });
      } catch (error) {
        logger.error("could not enqueue a scheduled run; trying again next round", { queue: name, error });
      }
    }
    for (const queue of queues) {
      const slots = running.get(queue) ?? new Set<RunningJob>();
      const free = getQueue(jobsOptions, queue).concurrency - slots.size;
      if (free <= 0 || options.signal.aborted) continue;
      try {
        const claimed = await claimJobs(ctx, { queue, limit: free, workerId });
        for (const job of claimed) slots.add(start(job));
      } catch (error) {
        logger.error("could not claim jobs", { queue, error });
      }
    }
    if (ctx.clock.now().getTime() - lastPruneAt >= PRUNE_INTERVAL_MS) {
      lastPruneAt = ctx.clock.now().getTime();
      try {
        const deleted = await pruneJobs(ctx);
        if (deleted > 0) logger.info("pruned finished jobs", { deleted });
      } catch (error) {
        logger.error("could not prune finished jobs", { error });
      }
    }
    await wakeUp.wait(jobsOptions.pollIntervalMs, options.signal);
  }

  await stop(running, { ctx, logger, graceMs: jobsOptions.shutdownGraceMs });
  logger.info("worker stopped", { workerId });
}

/**
 * Waits for running jobs up to the grace period, then aborts and releases the rest. A job leaves `running` when its
 * attempt settles, so what is still there after the grace period is unfinished.
 */
async function stop(running: ReadonlyMap<string, Set<RunningJob>>, options: { ctx: JobsContext; logger: JobsLogger; graceMs: number }): Promise<void> {
  const jobs = [...running.values()].flatMap((slots) => [...slots]);
  if (jobs.length === 0) return;
  options.logger.info("worker stopping; waiting for running jobs", { running: jobs.length, graceMs: options.graceMs });
  let timer: NodeJS.Timeout | undefined;
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, options.graceMs);
  });
  await Promise.race([Promise.all(jobs.map((job) => job.done)), grace]);
  clearTimeout(timer);

  const unfinished = [...running.values()].flatMap((slots) => [...slots]);
  for (const job of unfinished) {
    job.controller.abort();
    try {
      const isReleased = await releaseJob(options.ctx, job.claimed);
      if (isReleased) options.logger.info("job released for another worker", { queue: job.claimed.job.queue, jobId: job.claimed.job.id });
    } catch (error) {
      options.logger.error("could not release a job; it runs again when its lease ends", { queue: job.claimed.job.queue, jobId: job.claimed.job.id, error });
    }
  }
}

/** A sleep that a finished job (a free slot) or the abort signal cuts short. */
function createWakeUp(): { wake: () => void; wait: (ms: number, signal: AbortSignal) => Promise<void> } {
  let pending: (() => void) | undefined;
  let isWoken = false;
  return {
    wake: () => {
      isWoken = true;
      pending?.();
    },
    wait: (ms, signal) =>
      new Promise<void>((resolve) => {
        if (isWoken || signal.aborted) {
          isWoken = false;
          resolve();
          return;
        }
        const finish = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          pending = undefined;
          isWoken = false;
          resolve();
        };
        const timer = setTimeout(finish, ms);
        signal.addEventListener("abort", finish, { once: true });
        pending = finish;
      }),
  };
}
