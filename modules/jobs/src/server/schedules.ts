// Recurring schedules: each schedule's runs start on whole periods counted from the Unix epoch, so every worker
// computes the same period. A worker takes a period with a conditional upsert of `jobs.schedules` and enqueues its run
// in the same transaction, so each period is enqueued once however many workers race for it.
import { eq, inArray, lt } from "drizzle-orm";
import { parseEverySeconds, type JobScheduleOptions, type JobsOptions } from "../options.js";
import { schedules } from "../schema.js";
import type { JobsContext } from "./context.js";
import { enqueueJob } from "./enqueue.js";
import { getJobsOptions } from "./options.js";

/**
 * The dedup key of every scheduled run: while one run of a schedule is pending or running (retrying a failure, say),
 * the next period joins it instead of piling up a second run behind it.
 */
export const SCHEDULE_DEDUP_KEY = "schedule";

/** A schedule's health as `getQueueStats` reports it. */
export interface ScheduleState {
  readonly everySeconds: number;
  /** The start of the latest period a run was enqueued for; null before any worker saw the schedule. */
  readonly lastEnqueuedAt: Date | null;
  /** When a job of the schedule's queue last succeeded; null when none has yet. */
  readonly lastSucceededAt: Date | null;
  /**
   * True when no run succeeded within two periods (counted from when a worker first saw the schedule), or no worker
   * has seen it at all: no worker runs its queue, or its runs keep failing.
   */
  readonly isLate: boolean;
}

export interface EnqueueDueSchedulesInput {
  /** Only the schedules of these queues; default every schedule. */
  readonly queues?: readonly string[];
}

/** The start of the period `now` falls in. */
export function getScheduleSlot(schedule: JobScheduleOptions, now: Date): Date {
  const periodMs = getEverySeconds(schedule) * 1000;
  return new Date(Math.floor(now.getTime() / periodMs) * periodMs);
}

/**
 * Enqueues a run for every schedule whose current period has none yet, and returns their queue names. Missed periods
 * (no worker ran) collapse into one run for the current period. The worker calls it; an app that drains its queues
 * from a cron (`runDueJobs`) gets it from there. Database failures propagate.
 */
export async function enqueueDueSchedules(ctx: JobsContext, input: EnqueueDueSchedulesInput = {}): Promise<string[]> {
  const options = getJobsOptions(ctx.config);
  const enqueued: string[] = [];
  for (const name of getScheduleNames(options, input.queues)) {
    const slot = getScheduleSlot(getSchedule(options, name), ctx.clock.now());
    if (await enqueueScheduledRun(ctx, name, slot)) enqueued.push(name);
  }
  return enqueued;
}

/**
 * Takes `slot` for the schedule `name` and enqueues its run, in one transaction. False when the schedule already has
 * this period or a later one (another worker took it). Throws on a name that is not a schedule.
 */
export async function enqueueScheduledRun(ctx: JobsContext, name: string, slot: Date): Promise<boolean> {
  const schedule = getSchedule(getJobsOptions(ctx.config), name);
  const now = ctx.clock.now();
  return ctx.db.transaction(async (tx) => {
    const [taken] = await tx
      .insert(schedules)
      .values({ name, lastSlotAt: slot, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: schedules.name,
        set: { lastSlotAt: slot, updatedAt: now },
        setWhere: lt(schedules.lastSlotAt, slot),
      })
      .returning({ name: schedules.name });
    if (taken === undefined) return false;
    await enqueueJob({ ...ctx, db: tx }, { queue: name, payload: schedule.payload, dedupKey: SCHEDULE_DEDUP_KEY });
    return true;
  });
}

/** Notes a succeeded job of a scheduled queue (any job of it, a run enqueued by hand too). */
export async function recordScheduleSuccess(ctx: JobsContext, queue: string): Promise<void> {
  if (!Object.hasOwn(getJobsOptions(ctx.config).schedules, queue)) return;
  const now = ctx.clock.now();
  await ctx.db.update(schedules).set({ lastSucceededAt: now, updatedAt: now }).where(eq(schedules.name, queue));
}

/** The state of every configured schedule, by queue name. */
export async function getScheduleStates(ctx: JobsContext): Promise<Map<string, ScheduleState>> {
  const options = getJobsOptions(ctx.config);
  const names = Object.keys(options.schedules);
  if (names.length === 0) return new Map();
  const rows = await ctx.db.select().from(schedules).where(inArray(schedules.name, names));
  const now = ctx.clock.now().getTime();
  return new Map(
    names.map((name) => {
      const everySeconds = getEverySeconds(getSchedule(options, name));
      const row = rows.find((candidate) => candidate.name === name);
      const since = row?.lastSucceededAt ?? row?.createdAt ?? null;
      const isLate = since === null || now - since.getTime() > 2 * everySeconds * 1000;
      return [name, { everySeconds, lastEnqueuedAt: row?.lastSlotAt ?? null, lastSucceededAt: row?.lastSucceededAt ?? null, isLate }];
    }),
  );
}

/** The schedules among `queues` (default all), in configuration order. */
export function getScheduleNames(options: JobsOptions, queues: readonly string[] | undefined): string[] {
  return Object.keys(options.schedules).filter((name) => queues === undefined || queues.includes(name));
}

export function getSchedule(options: JobsOptions, name: string): JobScheduleOptions {
  const schedule = Object.hasOwn(options.schedules, name) ? options.schedules[name] : undefined;
  if (schedule === undefined) throw new Error(`@softure-ai/jobs: "${name}" is not a configured schedule`);
  return schedule;
}

function getEverySeconds(schedule: JobScheduleOptions): number {
  const seconds = parseEverySeconds(schedule.every);
  // The options schema refused any other value at startup.
  if (seconds === null) throw new Error(`@softure-ai/jobs: invalid schedule period "${schedule.every}"`);
  return seconds;
}
