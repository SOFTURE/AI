// Recurring schedules: a period schedule's runs start on whole periods counted from the Unix epoch, a local-time
// schedule's at its listed times of day in its time zone, so every worker computes the same slot. A worker takes a period with a conditional upsert of `jobs.schedules` and enqueues its run
// in the same transaction, so each period is enqueued once however many workers race for it.
import { eq, inArray, lt } from "drizzle-orm";
import { parseEverySeconds, type JobScheduleOptions, type JobsOptions, type LocalTimeScheduleOptions } from "../options.js";
import { schedules } from "../schema.js";
import { getWallClock, getZonedInstant } from "../zoned-time.js";
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
  /** The period; for a local-time schedule the longest gap between two of its times of day (24h for one time). */
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

/**
 * The slot `now` falls in: the start of its period, or the latest of the schedule's local times at or before `now`.
 * Slots only move forward as `now` does, across DST changes too.
 */
export function getScheduleSlot(schedule: JobScheduleOptions, now: Date): Date {
  if ("at" in schedule) return new Date(getLocalTimeSlot(schedule, now.getTime()));
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
  if ("at" in schedule) return getLongestGapSeconds(schedule.at);
  const seconds = parseEverySeconds(schedule.every);
  // The options schema refused any other value at startup.
  if (seconds === null) throw new Error(`@softure-ai/jobs: invalid schedule period "${schedule.every}"`);
  return seconds;
}

function getLocalTimeSlot(schedule: LocalTimeScheduleOptions, now: number): number {
  const today = getWallClock(now, schedule.timeZone);
  // The calendar day before today's local date; Date.UTC rolls day 0 over to the month before.
  const yesterday = new Date(Date.UTC(today.year, today.month - 1, today.day - 1));
  const days = [
    { year: yesterday.getUTCFullYear(), month: yesterday.getUTCMonth() + 1, day: yesterday.getUTCDate() },
    { year: today.year, month: today.month, day: today.day },
  ];
  let slot = Number.NEGATIVE_INFINITY;
  for (const day of days) {
    for (const time of schedule.at) {
      const [hour, minute] = time.split(":").map(Number);
      const instant = getZonedInstant({ ...day, hour: hour ?? 0, minute: minute ?? 0 }, schedule.timeZone);
      if (instant <= now && instant > slot) slot = instant;
    }
  }
  return slot;
}

/** The longest gap between two consecutive times of day, wrapping past midnight; `times` is sorted. */
function getLongestGapSeconds(times: readonly string[]): number {
  const minutes = times.map((time) => {
    const [hour, minute] = time.split(":").map(Number);
    return (hour ?? 0) * 60 + (minute ?? 0);
  });
  const gaps = minutes.map((minute, index) => (minutes[(index + 1) % minutes.length] ?? minute) - minute + (index === minutes.length - 1 ? 24 * 60 : 0));
  return Math.max(...gaps) * 60;
}
