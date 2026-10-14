// Enqueueing: one row in `jobs.jobs`, written through the caller's `db`, so inside its transaction the job exists
// exactly when the caller's own change commits.
import { and, eq, inArray, sql } from "drizzle-orm";
import { jobs } from "../schema.js";
import type { JobsContext } from "./context.js";
import { getJobsOptions, getQueue } from "./options.js";

const MAX_DEDUP_KEY_LENGTH = 200;
const MAX_DELAY_SECONDS = 365 * 24 * 60 * 60;
/** A dedup key can free up between the insert and the lookup (the live job finished); then the insert runs again. */
const MAX_DEDUP_ROUNDS = 3;

export interface EnqueueJobInput {
  /** A queue defined in `jobs({ queues })`. */
  readonly queue: string;
  /**
   * JSON data for the handler, `{}` when there is none; it is stored as `jsonb`, so a `Date` comes back as its ISO
   * string. Keep personal data out: ids, not names or e-mail addresses.
   */
  readonly payload: unknown;
  /** When the job becomes due; default now. Not together with `delaySeconds`. */
  readonly runAt?: Date;
  /** Seconds from now until the job is due. */
  readonly delaySeconds?: number;
  /**
   * While a pending or running job of this queue has the same key, no second one is enqueued: the call returns the
   * existing job's id with `isDuplicate: true`. A finished job frees its key.
   */
  readonly dedupKey?: string;
  /** Overrides the queue's `maxAttempts` for this job. */
  readonly maxAttempts?: number;
}

export interface EnqueuedJob {
  readonly id: string;
  /** True when a live job with the same `dedupKey` already existed and no new one was written. */
  readonly isDuplicate: boolean;
}

/**
 * Enqueues a job. Pass a transaction as `ctx.db` to enqueue together with the change that needs it:
 *
 *   await db.transaction(async (tx) => {
 *     await tx.insert(messages).values(message);
 *     await enqueueJob({ ...ctx, db: tx }, { queue: "ai.reply", payload: { messageId: message.id }, dedupKey: message.id });
 *   });
 *
 * Throws on an unknown queue or an invalid option (a bug in the caller); database failures propagate.
 */
export async function enqueueJob(ctx: JobsContext, input: EnqueueJobInput): Promise<EnqueuedJob> {
  const queue = getQueue(getJobsOptions(ctx.config), input.queue);
  checkInput(input);
  const now = ctx.clock.now();
  const runAt = input.runAt ?? new Date(now.getTime() + (input.delaySeconds ?? 0) * 1000);
  const values = {
    queue: input.queue,
    payload: input.payload,
    status: "pending" as const,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? queue.maxAttempts,
    runAt,
    dedupKey: input.dedupKey ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (input.dedupKey === undefined) {
    const [row] = await ctx.db.insert(jobs).values(values).returning();
    return { id: requireId(row?.id), isDuplicate: false };
  }

  for (let round = 0; round < MAX_DEDUP_ROUNDS; round += 1) {
    const [inserted] = await ctx.db
      .insert(jobs)
      .values(values)
      .onConflictDoNothing({
        target: [jobs.queue, jobs.dedupKey],
        where: sql`dedup_key is not null and status in ('pending', 'running')`,
      })
      .returning();
    if (inserted !== undefined) return { id: inserted.id.toString(), isDuplicate: false };

    const [existing] = await ctx.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.queue, input.queue), eq(jobs.dedupKey, input.dedupKey), inArray(jobs.status, ["pending", "running"])))
      .limit(1);
    if (existing !== undefined) return { id: existing.id.toString(), isDuplicate: true };
  }
  throw new Error(`@softure-ai/jobs: enqueueJob could not settle dedup key on queue "${input.queue}"; the live job kept changing`);
}

function checkInput(input: EnqueueJobInput): void {
  if (input.runAt !== undefined && input.delaySeconds !== undefined) {
    throw new Error("@softure-ai/jobs: enqueueJob takes runAt or delaySeconds, not both");
  }
  if (input.runAt !== undefined && Number.isNaN(input.runAt.getTime())) {
    throw new RangeError("@softure-ai/jobs: enqueueJob runAt is an invalid date");
  }
  if (input.delaySeconds !== undefined && !(input.delaySeconds >= 0 && input.delaySeconds <= MAX_DELAY_SECONDS)) {
    throw new RangeError(`@softure-ai/jobs: enqueueJob delaySeconds must be between 0 and ${String(MAX_DELAY_SECONDS)}`);
  }
  if (input.dedupKey !== undefined && (input.dedupKey.length === 0 || input.dedupKey.length > MAX_DEDUP_KEY_LENGTH)) {
    throw new RangeError(`@softure-ai/jobs: a dedup key must have 1 to ${String(MAX_DEDUP_KEY_LENGTH)} characters`);
  }
  if (input.maxAttempts !== undefined && !(Number.isInteger(input.maxAttempts) && input.maxAttempts >= 1 && input.maxAttempts <= 1000)) {
    throw new RangeError("@softure-ai/jobs: enqueueJob maxAttempts must be an integer from 1 to 1000");
  }
  if (input.payload === undefined || input.payload === null) {
    throw new Error("@softure-ai/jobs: enqueueJob needs a payload; pass {} for a job without data");
  }
}

function requireId(id: bigint | undefined): string {
  if (id === undefined) throw new Error("@softure-ai/jobs: the insert returned no id");
  return id.toString();
}
