// The options an app passes to `jobs({ ... })` in softure.config.ts, parsed at startup.
import { isTimeZone, type Err, type ErrorCode, type Ok } from "@softure-ai/core";
import { z } from "zod";
import type { JobAttemptEvent, JobFailedEvent, QueuePausedEvent, ScheduleStateChangedEvent } from "./contract.js";
import type { JobsContext } from "./server/context.js";

/** Which ends of a run the worker logs: every one, failures and retries only, or none. */
export const JOBS_RUN_LOG_LEVELS = ["all", "failures", "none"] as const;

export type JobsRunLogLevel = (typeof JOBS_RUN_LOG_LEVELS)[number];

const QUEUE_NAME = /^[a-z][a-z0-9_.-]{0,62}$/;
const QUEUE_NAME_HINT = "is not a queue name: lowercase letters, digits, _ . and -, starting with a letter";
const DAY_SECONDS = 24 * 60 * 60;

/** Runs once when a job ends `failed`; a throw is logged and changes nothing. */
export type OnJobFailedHook = (event: JobFailedEvent, ctx: JobsContext) => Promise<void> | void;
/** Runs once per recorded attempt, whatever its outcome; a throw is logged and changes nothing. */
export type OnJobAttemptHook = (event: JobAttemptEvent, ctx: JobsContext) => Promise<void> | void;
/** Runs once when the breaker or a handler (`pauseQueueLater`) pauses a queue; a throw is logged and changes nothing. */
export type OnQueuePausedHook = (event: QueuePausedEvent, ctx: JobsContext) => Promise<void> | void;
/** Runs once per transition of a schedule between `healthy`, `failing` and `late`; a throw is logged and changes nothing. */
export type OnScheduleStateChangedHook = (event: ScheduleStateChangedEvent, ctx: JobsContext) => Promise<void> | void;

/** The same pattern auth enforces for role names. */
const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

/**
 * The role check of the admin page: `{ requireRole, authorizeRole }` from `@softure-ai/auth/next`. Injected, because
 * auth itself depends on jobs. `requireRole` ends the request (Next's "not found") for anyone without the role;
 * `authorizeRole` returns an error code for the actions to show.
 */
export interface JobsPanelGuard {
  readonly requireRole: (role: string) => Promise<unknown>;
  readonly authorizeRole: (role: string) => Promise<Ok<unknown> | Err<ErrorCode>>;
}

function isPanelGuard(value: unknown): value is JobsPanelGuard {
  if (typeof value !== "object" || value === null) return false;
  const guard = value as Partial<Record<keyof JobsPanelGuard, unknown>>;
  return typeof guard.requireRole === "function" && typeof guard.authorizeRole === "function";
}

const backoffSchema = z
  .strictObject({
      /** Delay before the second attempt; each later one doubles it. */
      baseSeconds: z.number().int().min(1).max(DAY_SECONDS).default(10),
      /** The longest delay between two attempts. */
      maxSeconds: z.number().int().min(1).max(7 * DAY_SECONDS).default(3600),
    })
    .refine((backoff) => backoff.maxSeconds >= backoff.baseSeconds, {
      message: "maxSeconds must be at least baseSeconds",
      path: ["maxSeconds"],
    });

  const EVERY = /^([1-9][0-9]{0,4})(m|h|d)$/;
  const UNIT_SECONDS = { m: 60, h: 60 * 60, d: DAY_SECONDS } as const;
  const MAX_EVERY_SECONDS = 7 * DAY_SECONDS;
  const EVERY_HINT = "must be a whole number of minutes, hours or days (e.g. 15m, 1h, 1d), from 1m to 7d";

  /** Seconds of an `every` text such as `15m`, `1h` or `1d`; null when it is not one or is outside 1m to 7d. */
  export function parseEverySeconds(every: string): number | null {
    const match = EVERY.exec(every);
    if (match === null) return null;
    const seconds = Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS];
    return seconds <= MAX_EVERY_SECONDS ? seconds : null;
  }

  const AT_TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  const AT_HINT = "must be times of day as HH:MM (00:00 to 23:59), each once";
  const MAX_AT_TIMES = 48;
  const DAYS_OF_WEEK_HINT = "must be ISO days of the week (1 Monday to 7 Sunday), each once";
  const DAYS_OF_MONTH_HINT = 'must be days of the month (1 to 31, or "last"), each once';

  const isUnique = (values: readonly unknown[]): boolean => new Set(values).size === values.length;

  const scheduleSchema = z
    .strictObject({
      /** How often the schedule runs: `15m`, `1h`, `1d`. Runs start on whole periods counted from 1970-01-01 00:00 UTC. */
      every: z.string().refine((every) => parseEverySeconds(every) !== null, { message: EVERY_HINT }).optional(),
      /** Instead of `every`: the local times of day the schedule runs at, `HH:MM`, in `timeZone`. */
      at: z
        .array(z.string().regex(AT_TIME, { message: AT_HINT }))
        .min(1)
        .max(MAX_AT_TIMES)
        .refine((times) => new Set(times).size === times.length, { message: AT_HINT })
        .optional(),
      /** With `at`: the local days of the week it runs on, ISO 1 (Monday) to 7 (Sunday); default every day. */
      daysOfWeek: z
        .array(z.number().int().min(1, { message: DAYS_OF_WEEK_HINT }).max(7, { message: DAYS_OF_WEEK_HINT }))
        .min(1)
        .refine(isUnique, { message: DAYS_OF_WEEK_HINT })
        .optional(),
      /** With `at`: the local days of the month it runs on, 1 to 31 or `"last"`; a day a month lacks never matches. */
      daysOfMonth: z
        .array(
          z.union([z.number().int().min(1, { message: DAYS_OF_MONTH_HINT }).max(31, { message: DAYS_OF_MONTH_HINT }), z.literal("last")], {
            message: DAYS_OF_MONTH_HINT,
          }),
        )
        .min(1)
        .refine(isUnique, { message: DAYS_OF_MONTH_HINT })
        .optional(),
      /** The IANA time zone of `at`, such as `Europe/Warsaw`; required with `at`. */
      timeZone: z.string().refine(isTimeZone, { message: "is not a time zone the runtime knows (an IANA name such as Europe/Warsaw)" }).optional(),
      /** The payload of every run; default `{}`. */
      payload: z.record(z.string(), z.unknown()).default({}),
    })
    .superRefine((schedule, context) => {
      if ((schedule.every === undefined) === (schedule.at === undefined)) {
        context.addIssue({ code: "custom", path: ["every"], message: "set either every or at, not both" });
      }
      if (schedule.at !== undefined && schedule.timeZone === undefined) {
        context.addIssue({ code: "custom", path: ["timeZone"], message: "is required with at" });
      }
      if (schedule.every !== undefined && schedule.timeZone !== undefined) {
        context.addIssue({ code: "custom", path: ["timeZone"], message: "applies to at only; every runs in UTC" });
      }
      for (const filter of ["daysOfWeek", "daysOfMonth"] as const) {
        if (schedule.every !== undefined && schedule[filter] !== undefined) {
          context.addIssue({ code: "custom", path: [filter], message: "applies to at only; every has no local date" });
        }
      }
    })
    .transform((schedule): PeriodScheduleOptions | LocalTimeScheduleOptions => {
      if (schedule.at !== undefined && schedule.timeZone !== undefined) {
        return {
          at: [...schedule.at].sort(),
          timeZone: schedule.timeZone,
          ...(schedule.daysOfWeek === undefined ? {} : { daysOfWeek: [...schedule.daysOfWeek].sort((a, b) => a - b) }),
          ...(schedule.daysOfMonth === undefined ? {} : { daysOfMonth: sortDaysOfMonth(schedule.daysOfMonth) }),
          payload: schedule.payload,
        };
      }
      // The refinement above leaves every set whenever at is not.
      return { every: schedule.every ?? "", payload: schedule.payload };
    });

/** A schedule that runs once per period, aligned to UTC. */
export interface PeriodScheduleOptions {
  readonly every: string;
  readonly payload: Record<string, unknown>;
}

/** A day of the month a local-time schedule runs on: 1 to 31, or the month's last day. */
export type DayOfMonth = number | "last";

/**
 * A schedule that runs at local times of day in a time zone, on the local dates that match both filters (when given);
 * `at` and the filters are sorted.
 */
export interface LocalTimeScheduleOptions {
  readonly at: readonly string[];
  readonly timeZone: string;
  readonly daysOfWeek?: readonly number[];
  readonly daysOfMonth?: readonly DayOfMonth[];
  readonly payload: Record<string, unknown>;
}

const MINUTE_MS = 60_000;
/** What `last_error` holds: a code with a namespace, such as `app.rate_limited`. */
const ERROR_CODE = /^[^\s.]\S{0,98}\.\S{1,100}$/;
/** The longest pause the breaker grows to by default: 16 times its first pause, at most a week. */
const DEFAULT_MAX_PAUSE_FACTOR = 16;

const rateLimitSchema = z.union([
  z.strictObject({
    /** The shortest gap between two claims of the queue, across every worker. */
    minGapMs: z.number().int().min(1).max(DAY_SECONDS * 1000),
    /** Up to this much is added to each gap at random, so the calls do not tick like a clock. */
    jitterMs: z.number().int().min(0).max(60 * MINUTE_MS).default(0),
  }),
  z.strictObject({
    /** At most this many claims of the queue per window, across every worker. */
    max: z.number().int().min(1).max(100_000),
    /** The window's length; a window starts with its first claim. */
    perSeconds: z.number().int().min(1).max(DAY_SECONDS),
  }),
]);

const breakerSchema = z
  .strictObject({
    /** Counted failures in a row that pause the queue. */
    failures: z.number().int().min(1).max(1000),
    /** Only failures with these codes count; default every retried or attempt-exhausting failure. */
    codes: z
      .array(z.string().regex(ERROR_CODE, { message: "must be error codes such as app.rate_limited" }))
      .min(1)
      .refine((codes) => new Set(codes).size === codes.length, { message: "must name each code once" })
      .optional(),
    /** The first pause. */
    pauseSeconds: z.number().int().min(1).max(7 * DAY_SECONDS),
    /** The longest pause: each failure of the first run after a pause doubles it up to here. Default 16 × pauseSeconds, at most 7 days. */
    maxPauseSeconds: z.number().int().min(1).max(7 * DAY_SECONDS).optional(),
  })
  .refine((breaker) => breaker.maxPauseSeconds === undefined || breaker.maxPauseSeconds >= breaker.pauseSeconds, {
    message: "maxPauseSeconds must be at least pauseSeconds",
    path: ["maxPauseSeconds"],
  })
  .transform((breaker) => ({
    ...breaker,
    maxPauseSeconds: breaker.maxPauseSeconds ?? Math.min(breaker.pauseSeconds * DEFAULT_MAX_PAUSE_FACTOR, 7 * DAY_SECONDS),
  }));

const queueSchema = z.strictObject({
  /** Attempts before a job is `failed` for good; the first run counts. */
  maxAttempts: z.number().int().min(1).max(1000).default(5),
  /** Exponential delay between attempts. */
  backoff: backoffSchema.default({ baseSeconds: 10, maxSeconds: 3600 }),
  /**
   * How long a claimed job is reserved for its worker. The worker extends it while the handler runs, so this is how
   * long a crashed worker's job waits before another worker takes it, not a limit on the handler.
   */
  leaseSeconds: z.number().int().min(5).max(DAY_SECONDS).default(300),
  /** Jobs of this queue one worker process runs at the same time. */
  concurrency: z.number().int().min(1).max(100).default(1),
  /**
   * Pacing shared by every worker, enforced when jobs are claimed: `{ minGapMs, jitterMs? }` keeps a gap between two
   * claims, `{ max, perSeconds }` allows at most `max` claims per window. A job held back keeps its attempts.
   */
  rateLimit: rateLimitSchema.optional(),
  /**
   * Pauses the queue after `failures` counted failures in a row, for `pauseSeconds`; when the first run after a pause
   * fails again the pause doubles, up to `maxPauseSeconds`; a success resets it. A paused queue claims nothing.
   */
  breaker: breakerSchema.optional(),
});

const retentionSchema = z.strictObject({
  /** Days a succeeded job is kept before pruning deletes it. */
  succeededDays: z.number().int().min(0).max(3650).default(7),
  /** Days a failed job is kept, for inspection and `retryJob`. */
  failedDays: z.number().int().min(1).max(3650).default(30),
  /** Days a cancelled job is kept. */
  cancelledDays: z.number().int().min(0).max(3650).default(7),
  /** Days a sync ledger item is kept after the last run that met it (`processSyncItem`). */
  syncItemsDays: z.number().int().min(1).max(3650).default(90),
  /** Days a row of the run history is kept after its attempt finished, whatever happened to its job. */
  runsDays: z.number().int().min(1).max(3650).default(30),
  /**
   * Days an owned job (`enqueueJob({ ownerId })`) stays readable for its owner after it ends, whatever its status
   * retention says: a reload after the result still shows it. A floor: a longer status retention wins.
   */
  ownedDays: z.number().int().min(0).max(3650).default(1),
});

export const jobsOptionsSchema = z
  .strictObject({
    /** The queues, by name. A job is enqueued to one of them and runs with its settings. */
    queues: z.record(z.string(), queueSchema).default({}).superRefine(checkNames),
    /**
     * Recurring runs, by queue name: the worker enqueues one job per period (`every`) or per local time of day (`at`
     * in `timeZone`) however many workers run. A schedule's queue takes the default queue settings unless `queues`
     * names it.
     */
    schedules: z.record(z.string(), scheduleSchema).default({}).superRefine(checkNames),
    /** How long an idle worker waits before it looks for due jobs again. */
    pollIntervalMs: z.number().int().min(50).max(60_000).default(1000),
    /** How long a stopping worker waits for running handlers before it releases their jobs. */
    shutdownGraceMs: z.number().int().min(0).max(10 * 60_000).default(20_000),
    /** How long finished jobs, unseen sync ledger items and the run history are kept; the worker prunes once an hour. */
    retention: retentionSchema.default({ succeededDays: 7, failedDays: 30, cancelledDays: 7, syncItemsDays: 90, runsDays: 30, ownedDays: 1 }),
    /**
     * Which ends of a run the worker logs, one line each: `all` (succeeded, retried, failed), `failures` (retried and
     * failed) or `none`, for an app with very frequent queues.
     */
    logRuns: z.enum(JOBS_RUN_LOG_LEVELS).default("all"),
    /**
     * Runs once when a job ends `failed` (attempts used up, `failJob`, invalid payload, lease lost with no attempts
     * left), after the write commits: e.g. mail the operator.
     */
    onJobFailed: z.custom<OnJobFailedHook>((value) => typeof value === "function", "must be a function").optional(),
    /**
     * Runs once per attempt the worker or `runDueJobs` recorded, after the write commits, with `{ queue, jobId, origin,
     * attempt, maxAttempts, outcome, code, durationMs, at }`: e.g. count every queue's runs by outcome in the app's
     * metrics. Not for an attempt the claim fence refused (`stale`) or a lease that ended with no attempts left.
     */
    onJobAttempt: z.custom<OnJobAttemptHook>((value) => typeof value === "function", "must be a function").optional(),
    /**
     * Runs once per transition of a scheduled queue between `healthy`, `failing` and `late` (recovery included), so a
     * schedule that keeps failing alerts once. The worker checks at most once a minute; `runDueJobs` once at its end.
     */
    onScheduleStateChanged: z.custom<OnScheduleStateChangedHook>((value) => typeof value === "function", "must be a function").optional(),
    /**
     * Runs once when the breaker or a handler (`pauseQueueLater`) pauses a queue, after the write commits, with
     * `{ queue, code, until, source }`: e.g. tell the operator a provider started refusing. An operator's pause runs no hook.
     */
    onQueuePaused: z.custom<OnQueuePausedHook>((value) => typeof value === "function", "must be a function").optional(),
    /** The auth role that may open the admin page (`JobsPage`) and use its actions. */
    panelRole: z.string().regex(ROLE_NAME_PATTERN, "must be a role name such as admin").default("admin"),
    /**
     * The role check of the admin page: `{ requireRole, authorizeRole }` from `@softure-ai/auth/next`. Without it the
     * page is "not found" for everyone and its actions are refused.
     */
    panelGuard: z.custom<JobsPanelGuard>(isPanelGuard, "must be { requireRole, authorizeRole } from @softure-ai/auth/next").optional(),
  })
  .superRefine((options, context) => {
    if (Object.keys(options.queues).length === 0 && Object.keys(options.schedules).length === 0) {
      context.addIssue({ code: "custom", path: ["queues"], message: "must define at least one queue or schedule" });
    }
  })
  .transform((options) => {
    const scheduledOnly = Object.keys(options.schedules).filter((name) => !Object.hasOwn(options.queues, name));
    return { ...options, queues: { ...options.queues, ...Object.fromEntries(scheduledOnly.map((name) => [name, queueSchema.parse({})])) } };
  });

/** Days 1 to 31 in order, then `"last"`. */
function sortDaysOfMonth(days: readonly DayOfMonth[]): DayOfMonth[] {
  return [...days].sort((a, b) => (a === "last" ? 32 : a) - (b === "last" ? 32 : b));
}

function checkNames(record: Record<string, unknown>, context: z.RefinementCtx): void {
  for (const name of Object.keys(record).filter((candidate) => !QUEUE_NAME.test(candidate))) {
    context.addIssue({ code: "custom", path: [name], message: QUEUE_NAME_HINT });
  }
}

export type JobsOptionsInput = z.input<typeof jobsOptionsSchema>;
export type JobsOptions = z.output<typeof jobsOptionsSchema>;
export type JobQueueOptions = JobsOptions["queues"][string];
export type JobScheduleOptions = JobsOptions["schedules"][string];
export type JobQueueRateLimit = NonNullable<JobQueueOptions["rateLimit"]>;
export type JobQueueBreaker = NonNullable<JobQueueOptions["breaker"]>;
/** Schedules as an app or a package writes them, e.g. a package's ready-made prune schedules. */
export type JobSchedulesInput = NonNullable<JobsOptionsInput["schedules"]>;
