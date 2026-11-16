// The bookkeeping of one worker round, shared by the Node worker loop and the Workers tick: enqueue the due runs of
// the schedules, report schedule health to the app's hook, prune what outlived its retention. Each step logs its own
// database failure through the outage and lets the round go on.
import type { JobsContext } from "./context.js";
import type { DatabaseOutage } from "./database-outage.js";
import { checkScheduleStates } from "./hooks.js";
import type { JobsLogger } from "./logger.js";
import { pruneJobs } from "./maintenance.js";
import { getJobsOptions } from "./options.js";
import { pruneJobRuns } from "./runs.js";
import { enqueueScheduledRun, getSchedule, getScheduleSlot } from "./schedules.js";
import { pruneSyncItems } from "./sync-items.js";

export interface RoundStepOptions {
  readonly logger: JobsLogger;
  readonly outage: DatabaseOutage;
}

/**
 * Enqueues the current period's run of each schedule in `names` whose period `settledSlots` does not hold yet, and
 * records each period it settled (enqueued, or found taken), so a caller that keeps the map writes once per period.
 */
export async function enqueueRoundSchedules(
  ctx: JobsContext,
  names: readonly string[],
  settledSlots: Map<string, number>,
  options: RoundStepOptions,
): Promise<void> {
  const jobsOptions = getJobsOptions(ctx.config);
  for (const name of names) {
    const slot = getScheduleSlot(getSchedule(jobsOptions, name), ctx.clock.now());
    if ((settledSlots.get(name) ?? Number.NEGATIVE_INFINITY) >= slot.getTime()) continue;
    try {
      const isEnqueued = await enqueueScheduledRun(ctx, name, slot);
      options.outage.recover();
      settledSlots.set(name, slot.getTime());
      if (isEnqueued) options.logger.info("scheduled run enqueued", { queue: name, slot: slot.toISOString() });
    } catch (error) {
      options.outage.fail("could not enqueue a scheduled run; trying again next round", { queue: name, error });
    }
  }
}

/** Compares schedule health with what `onScheduleStateChanged` last reported. */
export async function checkRoundScheduleStates(ctx: JobsContext, options: RoundStepOptions): Promise<void> {
  try {
    await checkScheduleStates(ctx, { logger: options.logger });
    options.outage.recover();
  } catch (error) {
    options.outage.fail("could not check schedule states", { error });
  }
}

/** Prunes finished jobs, the run history and the sync ledger past their retention. */
export async function pruneRound(ctx: JobsContext, options: RoundStepOptions): Promise<void> {
  const steps = [
    { prune: pruneJobs, done: "pruned finished jobs", failed: "could not prune finished jobs" },
    { prune: pruneJobRuns, done: "pruned the run history", failed: "could not prune the run history" },
    { prune: pruneSyncItems, done: "pruned sync ledger items", failed: "could not prune sync ledger items" },
  ];
  for (const step of steps) {
    try {
      const deleted = await step.prune(ctx);
      options.outage.recover();
      if (deleted > 0) options.logger.info(step.done, { deleted });
    } catch (error) {
      options.outage.fail(step.failed, { error });
    }
  }
}
