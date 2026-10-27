// Recurring schedules: a period schedule's runs start on whole periods counted from the Unix epoch, a local-time
// schedule's at its listed times of day in its time zone, so every worker computes the same slot. A worker takes a period with a conditional upsert of `jobs.schedules` and enqueues its run
// in the same transaction, so each period is enqueued once however many workers race for it.
import { err, getWallClock, getZonedInstant, ok, type Err, type Ok } from "@softure-ai/core";
import { eq, inArray, lt } from "drizzle-orm";
import {
  parseEverySeconds,
  type JobScheduleOptions,
  type JobsOptions,
  type LocalTimeScheduleOptions,
  type PeriodScheduleOptions,
} from "../options.js";
import { schedules } from "../schema.js";
import type { JobsContext } from "./context.js";
import { enqueueJob, type EnqueuedJob } from "./enqueue.js";
import { getJobsOptions } from "./options.js";

/**
 * The dedup key of every scheduled run: while one run of a schedule is pending or running (retrying a failure, say),
 * the next period joins it instead of piling up a second run behind it.
 */
export const SCHEDULE_DEDUP_KEY = "schedule";

/** A schedule's health as `getQueueStats` reports it. */
export interface ScheduleState {
  /** The period; for a local-time schedule the gap from its current slot to the next one. */
  readonly everySeconds: number;
  /** The start of the latest period a run was enqueued for; null before any worker saw the schedule. */
  readonly lastEnqueuedAt: Date | null;
  /** When a job of the schedule's queue last succeeded; null when none has yet. */
  readonly lastSucceededAt: Date | null;
  /** When a job of the schedule's queue last ended `failed` (attempts used up, or failed for good); null when none has. */
  readonly lastFailedAt: Date | null;
  /** That job's error code (the handler's code, `jobs.handler_threw`, `jobs.lease_expired`…); null when none failed. */
  readonly lastFailureCode: string | null;
  /**
   * True when no run succeeded within two periods (counted from when a worker first saw the schedule), or no worker
   * has seen it at all: no worker runs its queue, or its runs keep failing. For a local-time schedule two periods are
   * its next two slots, so a weekday schedule is not late over the weekend.
   */
  readonly isLate: boolean;
  /** True when the latest outcome is a failure: `lastFailedAt` is later than `lastSucceededAt`, or nothing succeeded. */
  readonly isFailing: boolean;
}

export interface EnqueueDueSchedulesInput {
  /** Only the schedules of these queues; default every schedule. */
  readonly queues?: readonly string[];
}

/**
 * The slot `now` falls in: the start of its period, or the latest of the schedule's local times at or before `now` on
 * a local date its filters let through. Slots only move forward as `now` does, across DST changes too.
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
    await enqueueJob({ ...ctx, db: tx }, { queue: name, payload: schedule.payload, dedupKey: SCHEDULE_DEDUP_KEY, origin: "schedule" });
    return true;
  });
}

export type RunScheduleNowResult = Ok<EnqueuedJob> | Err<"jobs.not_a_schedule">;

export interface RunScheduleNowOptions {
  /** What started the run, kept with the job and its runs; default `manual`. */
  readonly origin?: string;
}

/**
 * Enqueues a run of the schedule `queue` now, with its payload and its dedup key: while a run is pending or running,
 * this joins it (`isDuplicate: true`, and the waiting run keeps its own origin). The schedule's period is left alone,
 * so its regular run still comes. Refused with `jobs.not_a_schedule` for a queue `schedules` does not name.
 */
export async function runScheduleNow(ctx: JobsContext, queue: string, options: RunScheduleNowOptions = {}): Promise<RunScheduleNowResult> {
  const jobsOptions = getJobsOptions(ctx.config);
  if (!Object.hasOwn(jobsOptions.schedules, queue)) return err("jobs.not_a_schedule");
  const schedule = getSchedule(jobsOptions, queue);
  return ok(await enqueueJob(ctx, { queue, payload: schedule.payload, dedupKey: SCHEDULE_DEDUP_KEY, origin: options.origin ?? "manual" }));
}

/** Notes a succeeded job of a scheduled queue (any job of it, a run enqueued by hand too). */
export async function recordScheduleSuccess(ctx: JobsContext, queue: string): Promise<void> {
  if (!Object.hasOwn(getJobsOptions(ctx.config).schedules, queue)) return;
  const now = ctx.clock.now();
  await ctx.db.update(schedules).set({ lastSucceededAt: now, updatedAt: now }).where(eq(schedules.name, queue));
}

/** Notes a failed job of a scheduled queue (terminal, not a retried attempt) with its error code. */
export async function recordScheduleFailure(ctx: JobsContext, queue: string, code: string): Promise<void> {
  if (!Object.hasOwn(getJobsOptions(ctx.config).schedules, queue)) return;
  const now = ctx.clock.now();
  await ctx.db.update(schedules).set({ lastFailedAt: now, lastFailureCode: code, updatedAt: now }).where(eq(schedules.name, queue));
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
      const schedule = getSchedule(options, name);
      const row = rows.find((candidate) => candidate.name === name);
      const since = row?.lastSucceededAt ?? row?.createdAt ?? null;
      const { everySeconds, isLate } = getLateness(schedule, now, since?.getTime() ?? null);
      const lastSucceededAt = row?.lastSucceededAt ?? null;
      const lastFailedAt = row?.lastFailedAt ?? null;
      const isFailing = lastFailedAt !== null && (lastSucceededAt === null || lastFailedAt > lastSucceededAt);
      const lastFailureCode = row?.lastFailureCode ?? null;
      return [name, { everySeconds, lastEnqueuedAt: row?.lastSlotAt ?? null, lastSucceededAt, lastFailedAt, lastFailureCode, isLate, isFailing }];
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

/**
 * A schedule's period at `now` and whether it is late: no success (or first sighting, `since`) within two periods.
 * A local-time schedule's period is the gap from its current slot to the next, and it is late once the second slot
 * after `since` has passed.
 */
function getLateness(schedule: JobScheduleOptions, now: number, since: number | null): { everySeconds: number; isLate: boolean } {
  if ("at" in schedule) {
    const slot = getLocalTimeSlot(schedule, now);
    const everySeconds = (getNextLocalTimeSlot(schedule, slot) - slot) / 1000;
    const isLate = since === null || now > getNextLocalTimeSlot(schedule, getNextLocalTimeSlot(schedule, since));
    return { everySeconds, isLate };
  }
  const everySeconds = getEverySeconds(schedule);
  return { everySeconds, isLate: since === null || now - since > 2 * everySeconds * 1000 };
}

function getEverySeconds(schedule: PeriodScheduleOptions): number {
  const seconds = parseEverySeconds(schedule.every);
  // The options schema refused any other value at startup.
  if (seconds === null) throw new Error(`@softure-ai/jobs: invalid schedule period "${schedule.every}"`);
  return seconds;
}

/**
 * The local dates a slot is looked for on, back or forward from `instant`. The rarest filter (the 31st on one weekday)
 * recurs within 609 days over the 400-year Gregorian cycle, so the search always ends with a slot.
 */
const MAX_SEARCH_DAYS = 800;

/** The latest slot at or before `now`. */
function getLocalTimeSlot(schedule: LocalTimeScheduleOptions, now: number): number {
  return findLocalTimeSlot(schedule, now, -1, (instant) => instant <= now);
}

/** The earliest slot after `after`. */
function getNextLocalTimeSlot(schedule: LocalTimeScheduleOptions, after: number): number {
  return findLocalTimeSlot(schedule, after, 1, (instant) => instant > after);
}

/**
 * Walks local dates from the one `instant` falls on (`step` -1 back, 1 forward) and returns, on the first date the
 * filters let through with a time that `isWanted`, the nearest such time.
 */
function findLocalTimeSlot(schedule: LocalTimeScheduleOptions, instant: number, step: -1 | 1, isWanted: (candidate: number) => boolean): number {
  const start = getWallClock(new Date(instant), schedule.timeZone);
  for (let offset = 0; offset <= MAX_SEARCH_DAYS; offset += 1) {
    // Date.UTC rolls a day outside the month over into the month before or after.
    const date = new Date(Date.UTC(start.year, start.month - 1, start.day + step * offset));
    if (!isScheduledDate(schedule, date)) continue;
    const day = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
    const instants = schedule.at
      .map((time) => {
        const [hour, minute] = time.split(":").map(Number);
        return getZonedInstant({ ...day, hour: hour ?? 0, minute: minute ?? 0 }, schedule.timeZone).getTime();
      })
      .filter(isWanted);
    if (instants.length > 0) return step < 0 ? Math.max(...instants) : Math.min(...instants);
  }
  // Unreachable for the filters the options schema accepts (see MAX_SEARCH_DAYS).
  throw new Error(`@softure-ai/jobs: no slot within ${MAX_SEARCH_DAYS} days of the schedule's filters`);
}

/** True when the local date (`date` at midnight UTC) passes the schedule's day-of-week and day-of-month filters. */
function isScheduledDate(schedule: LocalTimeScheduleOptions, date: Date): boolean {
  const isoWeekday = ((date.getUTCDay() + 6) % 7) + 1;
  if (schedule.daysOfWeek !== undefined && !schedule.daysOfWeek.includes(isoWeekday)) return false;
  if (schedule.daysOfMonth === undefined) return true;
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return schedule.daysOfMonth.some((day) => (day === "last" ? date.getUTCDate() === lastDay : date.getUTCDate() === day));
}
