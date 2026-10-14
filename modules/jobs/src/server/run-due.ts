// Runs every due job once, in this process, one after another: the worker's code path without the loop. For unit
// tests (`@softure-ai/jobs/testing`) and for an app that drains a queue from a cron instead of running a worker.
import type { JobHandlers } from "../handlers.js";
import { claimJobs } from "./claim.js";
import type { JobsContext } from "./context.js";
import { consoleJobsLogger, type JobsLogger } from "./logger.js";
import { getJobsOptions } from "./options.js";
import { runClaimedJob } from "./process.js";
import { checkHandlers } from "./handler-check.js";

const DEFAULT_MAX_JOBS = 1000;
const NEVER_ABORTED = new AbortController().signal;

export interface RunDueJobsOptions {
  readonly handlers: JobHandlers;
  /** Only these queues; default every queue that has a handler. */
  readonly queues?: readonly string[];
  readonly logger?: JobsLogger;
  /** Stored in `locked_by`; default `run-due-jobs`. */
  readonly workerId?: string;
  /** The jitter of retry delays, in [0, 1); tests pass `() => 0` for exact delays. */
  readonly random?: () => number;
  /** Stops after this many attempts, so a job that is due again at once cannot loop forever. Default 1000. */
  readonly maxJobs?: number;
}

export interface RunDueJobsReport {
  readonly succeeded: number;
  readonly retried: number;
  readonly failed: number;
  /** Attempts whose outcome another claim had already replaced. */
  readonly stale: number;
}

/**
 * Claims and runs due jobs until none is due (a retried job is due later, so it waits for the clock). Returns what
 * happened. Throws on a handler for a queue the config does not define; database failures propagate.
 */
export async function runDueJobs(ctx: JobsContext, options: RunDueJobsOptions): Promise<RunDueJobsReport> {
  const queues = checkHandlers(getJobsOptions(ctx.config), options.handlers, options.queues);
  const report = { succeeded: 0, retried: 0, failed: 0, stale: 0 };
  const maxJobs = options.maxJobs ?? DEFAULT_MAX_JOBS;
  const runOptions = {
    handlers: options.handlers,
    logger: options.logger ?? consoleJobsLogger,
    signal: NEVER_ABORTED,
    random: options.random ?? Math.random,
  };
  let attempts = 0;
  let hasClaimed = true;
  while (hasClaimed && attempts < maxJobs) {
    hasClaimed = false;
    for (const queue of queues) {
      const [claimed] = await claimJobs(ctx, { queue, limit: 1, workerId: options.workerId ?? "run-due-jobs" });
      if (claimed === undefined) continue;
      hasClaimed = true;
      attempts += 1;
      const outcome = await runClaimedJob(ctx, claimed, runOptions);
      report[outcome.kind] += 1;
      if (attempts >= maxJobs) break;
    }
  }
  return report;
}
