// The options an app passes to `jobs({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import { isTimeZone } from "./zoned-time.js";

const QUEUE_NAME = /^[a-z][a-z0-9_.-]{0,62}$/;
const QUEUE_NAME_HINT = "is not a queue name: lowercase letters, digits, _ . and -, starting with a letter";
const DAY_SECONDS = 24 * 60 * 60;

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
    })
    .transform((schedule): PeriodScheduleOptions | LocalTimeScheduleOptions => {
      if (schedule.at !== undefined && schedule.timeZone !== undefined) {
        return { at: [...schedule.at].sort(), timeZone: schedule.timeZone, payload: schedule.payload };
      }
      // The refinement above leaves every set whenever at is not.
      return { every: schedule.every ?? "", payload: schedule.payload };
    });

/** A schedule that runs once per period, aligned to UTC. */
export interface PeriodScheduleOptions {
  readonly every: string;
  readonly payload: Record<string, unknown>;
}

/** A schedule that runs at local times of day in a time zone; `at` is sorted. */
export interface LocalTimeScheduleOptions {
  readonly at: readonly string[];
  readonly timeZone: string;
  readonly payload: Record<string, unknown>;
}

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
    /** How long finished jobs and unseen sync ledger items are kept; the worker prunes once an hour. */
    retention: retentionSchema.default({ succeededDays: 7, failedDays: 30, cancelledDays: 7, syncItemsDays: 90 }),
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

function checkNames(record: Record<string, unknown>, context: z.RefinementCtx): void {
  for (const name of Object.keys(record).filter((candidate) => !QUEUE_NAME.test(candidate))) {
    context.addIssue({ code: "custom", path: [name], message: QUEUE_NAME_HINT });
  }
}

export type JobsOptionsInput = z.input<typeof jobsOptionsSchema>;
export type JobsOptions = z.output<typeof jobsOptionsSchema>;
export type JobQueueOptions = JobsOptions["queues"][string];
export type JobScheduleOptions = JobsOptions["schedules"][string];
/** Schedules as an app or a package writes them, e.g. a package's ready-made prune schedules. */
export type JobSchedulesInput = NonNullable<JobsOptionsInput["schedules"]>;
