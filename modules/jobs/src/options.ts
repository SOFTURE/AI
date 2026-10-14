// The options an app passes to `jobs({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";

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
});

export const jobsOptionsSchema = z.strictObject({
  /** The queues, by name. A job is enqueued to one of them and runs with its settings. */
  queues: z.record(z.string(), queueSchema).superRefine((queues, context) => {
    const names = Object.keys(queues);
    if (names.length === 0) {
      context.addIssue({ code: "custom", message: "must define at least one queue" });
    }
    for (const name of names.filter((candidate) => !QUEUE_NAME.test(candidate))) {
      context.addIssue({ code: "custom", path: [name], message: QUEUE_NAME_HINT });
    }
  }),
  /** How long an idle worker waits before it looks for due jobs again. */
  pollIntervalMs: z.number().int().min(50).max(60_000).default(1000),
  /** How long a stopping worker waits for running handlers before it releases their jobs. */
  shutdownGraceMs: z.number().int().min(0).max(10 * 60_000).default(20_000),
  /** How long finished jobs are kept; the worker prunes once an hour. */
  retention: retentionSchema.default({ succeededDays: 7, failedDays: 30, cancelledDays: 7 }),
});

export type JobsOptionsInput = z.input<typeof jobsOptionsSchema>;
export type JobsOptions = z.output<typeof jobsOptionsSchema>;
export type JobQueueOptions = JobsOptions["queues"][string];
