// One claimed job run under its lease: the handler runs while a timer extends the lease, aborts the handler when the
// lease is lost or an operator cancels, and logs a failed recording. The Node worker loop and the Workers tick start
// every job through here.
import type { JobHandlers } from "../handlers.js";
import { JobCancelledError } from "../progress.js";
import { heartbeatJob, type ClaimedJob } from "./claim.js";
import type { JobsContext } from "./context.js";
import type { DatabaseOutage } from "./database-outage.js";
import type { JobsLogger } from "./logger.js";
import { getJobsOptions, getQueue } from "./options.js";
import { runClaimedJob } from "./process.js";

/** A lease is extended three times per lease period, so one slow write does not lose it. */
const HEARTBEATS_PER_LEASE = 3;

export interface LeasedRun {
  readonly claimed: ClaimedJob;
  readonly controller: AbortController;
  /** Settles when the attempt is recorded (or its recording failed and was logged); never rejects. */
  readonly done: Promise<void>;
}

export interface StartLeasedRunOptions {
  readonly handlers: JobHandlers;
  readonly logger: JobsLogger;
  readonly outage: DatabaseOutage;
  readonly random: () => number;
  /** How often the lease is extended; default a third of the queue's `leaseSeconds`. */
  readonly heartbeatMs?: number;
  /** Called once the attempt settled, after the lease timer stopped. */
  readonly onSettled: (run: LeasedRun) => void;
}

export function startLeasedRun(ctx: JobsContext, claimed: ClaimedJob, options: StartLeasedRunOptions): LeasedRun {
  const { logger, outage } = options;
  const controller = new AbortController();
  const heartbeatMs = options.heartbeatMs ?? (getQueue(getJobsOptions(ctx.config), claimed.job.queue).leaseSeconds * 1000) / HEARTBEATS_PER_LEASE;
  const heartbeat = setInterval(() => {
    heartbeatJob(ctx, claimed).then(
      (state) => {
        outage.recover();
        if (controller.signal.aborted || state === "held") return;
        if (state === "cancel_requested") {
          logger.info("job cancelled by an operator; its handler is aborted", { queue: claimed.job.queue, jobId: claimed.job.id });
          controller.abort(new JobCancelledError());
          return;
        }
        logger.warn("job lease lost; its handler is aborted", { queue: claimed.job.queue, jobId: claimed.job.id });
        controller.abort();
      },
      (error: unknown) => {
        outage.fail("could not extend a job lease", { queue: claimed.job.queue, jobId: claimed.job.id, error });
      },
    );
  }, heartbeatMs);
  const done = runClaimedJob(ctx, claimed, { handlers: options.handlers, logger, signal: controller.signal, random: options.random })
    .then(
      (outcome) => {
        outage.recover();
        if (outcome.kind === "stale") logger.warn("job outcome not recorded: the job was taken over or released", { queue: claimed.job.queue, jobId: claimed.job.id });
      },
      (error: unknown) => {
        outage.fail("could not record a job outcome; it runs again when its lease ends", { queue: claimed.job.queue, jobId: claimed.job.id, error });
      },
    )
    .finally(() => {
      clearInterval(heartbeat);
      options.onSettled(run);
    });
  const run: LeasedRun = { claimed, controller, done };
  return run;
}
