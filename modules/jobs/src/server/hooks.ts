// The app's alert hooks: `onJobFailed` after a job ends `failed`, `onScheduleStateChanged` once per transition of a
// schedule's health. A hook runs after the write that caused it commits; a throw is logged by kind and never reaches
// the job, the claim or the worker.
import { and, eq, ne } from "drizzle-orm";
import type { JobFailedEvent, ScheduleHealth } from "../contract.js";
import { schedules } from "../schema.js";
import type { JobsContext } from "./context.js";
import { consoleJobsLogger, type JobsLogger } from "./logger.js";
import { getJobsOptions } from "./options.js";
import { getScheduleStates, type ScheduleState } from "./schedules.js";

export interface HookOptions {
  /** Where a hook failure is logged; default the console logger. */
  readonly logger?: JobsLogger;
}

/** Runs `onJobFailed` for each event, when the app set it. */
export async function notifyJobFailed(ctx: JobsContext, events: readonly JobFailedEvent[], options: HookOptions = {}): Promise<void> {
  const hook = getJobsOptions(ctx.config).onJobFailed;
  if (hook === undefined) return;
  for (const event of events) {
    await runHook("onJobFailed", () => hook(event, ctx), { queue: event.queue, jobId: event.jobId }, options.logger);
  }
}

/**
 * Compares every seen schedule's health with the one last reported and runs `onScheduleStateChanged` for each that
 * moved, after taking the transition with a conditional update, so racing workers report it once. Returns the queues
 * whose transition this call reported. Does nothing when the app set no hook; a schedule no worker has enqueued yet
 * is skipped. Database failures propagate.
 */
export async function checkScheduleStates(ctx: JobsContext, options: HookOptions = {}): Promise<string[]> {
  const hook = getJobsOptions(ctx.config).onScheduleStateChanged;
  if (hook === undefined) return [];
  const reported: string[] = [];
  for (const [queue, state] of await getScheduleStates(ctx)) {
    if (state.lastEnqueuedAt === null) continue;
    const health = getScheduleHealth(state);
    const now = ctx.clock.now();
    const taken = await ctx.db
      .update(schedules)
      .set({ reportedState: health, updatedAt: now })
      .where(and(eq(schedules.name, queue), ne(schedules.reportedState, health)))
      .returning({ name: schedules.name });
    if (taken.length === 0) continue;
    reported.push(queue);
    const event = { queue, state: health, lastFailureCode: state.lastFailureCode, at: now };
    await runHook("onScheduleStateChanged", () => hook(event, ctx), { queue, state: health }, options.logger);
  }
  return reported;
}

/** One state per schedule: `failing` wins over `late`, which a failing schedule usually is too. */
export function getScheduleHealth(state: ScheduleState): ScheduleHealth {
  if (state.isFailing) return "failing";
  return state.isLate ? "late" : "healthy";
}

async function runHook(name: string, call: () => Promise<void> | void, fields: Record<string, unknown>, logger: JobsLogger = consoleJobsLogger): Promise<void> {
  try {
    await call();
  } catch (error) {
    logger.error(`the ${name} hook failed`, { ...fields, error });
  }
}
