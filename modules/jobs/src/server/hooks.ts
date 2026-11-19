// The app's hooks: `onJobAttempt` after every recorded attempt, `onJobFailed` after a job ends `failed`, `onQueuePaused` when the breaker or a handler pauses
// a queue, `onScheduleStateChanged` once per transition of a schedule's health. A hook runs after the write that caused it commits; a throw is logged by kind and never reaches
// the job, the claim or the worker, and a call past `hookTimeoutMs` is logged and left behind with its signal aborted.
import { and, eq, ne } from "drizzle-orm";
import type { JobAttemptEvent, JobFailedEvent, QueuePausedEvent, ScheduleHealth } from "../contract.js";
import { schedules } from "../schema.js";
import type { JobsContext } from "./context.js";
import { consoleJobsLogger, type JobsLogger } from "./logger.js";
import { getJobsOptions } from "./options.js";
import type { JobsHookContext } from "../options.js";
import { getScheduleStates, type ScheduleState } from "./schedules.js";

export interface HookOptions {
  /** Where a hook failure is logged; default the console logger. */
  readonly logger?: JobsLogger;
}

/** Runs `onJobAttempt` for a recorded attempt, when the app set it. */
export async function notifyJobAttempt(ctx: JobsContext, event: JobAttemptEvent, options: HookOptions = {}): Promise<void> {
  const { onJobAttempt: hook, hookTimeoutMs } = getJobsOptions(ctx.config);
  if (hook === undefined) return;
  const fields = { queue: event.queue, jobId: event.jobId, outcome: event.outcome };
  await runHook({ name: "onJobAttempt", call: (context) => hook(event, ctx, context), fields, timeoutMs: hookTimeoutMs, logger: options.logger });
}

/** Runs `onJobFailed` for each event, when the app set it. */
export async function notifyJobFailed(ctx: JobsContext, events: readonly JobFailedEvent[], options: HookOptions = {}): Promise<void> {
  const { onJobFailed: hook, hookTimeoutMs } = getJobsOptions(ctx.config);
  if (hook === undefined) return;
  for (const event of events) {
    const fields = { queue: event.queue, jobId: event.jobId };
    await runHook({ name: "onJobFailed", call: (context) => hook(event, ctx, context), fields, timeoutMs: hookTimeoutMs, logger: options.logger });
  }
}

/** Runs `onQueuePaused` for a pause by the breaker or a handler, when the app set it. */
export async function notifyQueuePaused(ctx: JobsContext, event: QueuePausedEvent, options: HookOptions = {}): Promise<void> {
  const { onQueuePaused: hook, hookTimeoutMs } = getJobsOptions(ctx.config);
  if (hook === undefined) return;
  const fields = { queue: event.queue, code: event.code, source: event.source };
  await runHook({ name: "onQueuePaused", call: (context) => hook(event, ctx, context), fields, timeoutMs: hookTimeoutMs, logger: options.logger });
}

/**
 * Compares every seen schedule's health with the one last reported and runs `onScheduleStateChanged` for each that
 * moved, after taking the transition with a conditional update, so racing workers report it once. Returns the queues
 * whose transition this call reported. Does nothing when the app set no hook; a schedule no worker has enqueued yet
 * is skipped. Database failures propagate.
 */
export async function checkScheduleStates(ctx: JobsContext, options: HookOptions = {}): Promise<string[]> {
  const { onScheduleStateChanged: hook, hookTimeoutMs } = getJobsOptions(ctx.config);
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
    const fields = { queue, state: health };
    await runHook({ name: "onScheduleStateChanged", call: (context) => hook(event, ctx, context), fields, timeoutMs: hookTimeoutMs, logger: options.logger });
  }
  return reported;
}

/** One state per schedule: `failing` wins over `late`, which a failing schedule usually is too. */
export function getScheduleHealth(state: ScheduleState): ScheduleHealth {
  if (state.isFailing) return "failing";
  return state.isLate ? "late" : "healthy";
}

interface RunHookInput {
  readonly name: string;
  readonly call: (context: JobsHookContext) => Promise<void> | void;
  readonly fields: Record<string, unknown>;
  readonly timeoutMs: number;
  readonly logger?: JobsLogger;
}

const TIMED_OUT = Symbol("timed out");

/** Runs one hook call, bounded by `timeoutMs`: a throw is logged, a timeout is logged and aborts the call's signal. */
async function runHook(input: RunHookInput): Promise<void> {
  const logger = input.logger ?? consoleJobsLogger;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), input.timeoutMs);
  });
  // A call that settles after its timeout is left behind: its rejection is caught here so it is never unhandled.
  const call = Promise.resolve()
    .then(() => input.call({ signal: controller.signal }))
    .then(
      () => undefined,
      (error: unknown) => ({ error }),
    );
  try {
    const outcome = await Promise.race([call, timeout]);
    if (outcome === TIMED_OUT) {
      controller.abort();
      logger.error(`the ${input.name} hook timed out`, { ...input.fields, timeoutMs: input.timeoutMs });
    } else if (outcome !== undefined) {
      logger.error(`the ${input.name} hook failed`, { ...input.fields, error: outcome.error });
    }
  } finally {
    clearTimeout(timer);
  }
}
