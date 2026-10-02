// The fixed-window limiter (FIRE_TRACKER `src/db/auth-attempts.ts`, generalised to buckets from
// configuration). Each attempt is counted before the work it guards, so a flood of requests that
// would succeed is stopped as well, and before it costs anything.
import { err, errorLogLabel, ok, type ModuleContext, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, eq, lt, notInArray, or, sql } from "drizzle-orm";
import type { RateLimitAllowance, RateLimitRejection } from "../contract.js";
import { rateLimits } from "../schema.js";
import { getBucket, getSecurityOptions } from "./options.js";

export type SecurityContext = ModuleContext<Queryable>;

export interface RateLimitTarget {
  /** A bucket defined in the module options. */
  readonly bucket: string;
  /** Whose attempts are counted: `identifyClient` or `subjectKey` gives one. */
  readonly key: string;
}

export type RateLimitResult = Ok<RateLimitAllowance> | RateLimitRejection;

const MAX_KEY_LENGTH = 200;
const MINUTE_MS = 60_000;
/** Rows are deleted two windows after they started, so a row still in use is never removed. */
const CLEANUP_AFTER_WINDOWS = 2;

/**
 * Counts one attempt and says whether it fits in the bucket's window.
 *
 * One statement, `INSERT … ON CONFLICT DO UPDATE`: a separate read and write would let two parallel
 * requests both see room under the limit. The counter stops at `limit + 1`, so a long flood cannot
 * overflow it. Now and then (`cleanupProbability`) the call also deletes expired rows: cleanup that
 * waits for a successful login never runs during a distributed flood, when nobody logs in. A
 * failed cleanup is logged and does not change the answer: the attempt is already counted.
 *
 * Database failures propagate; wrap the call and turn them into `safeError` like any query.
 */
export async function consumeRateLimit(ctx: SecurityContext, target: RateLimitTarget): Promise<RateLimitResult> {
  const options = getSecurityOptions(ctx.config);
  const bucket = getBucket(options, target.bucket);
  assertKey(target.key);

  const now = ctx.clock.now();
  const windowMs = bucket.windowMinutes * MINUTE_MS;
  const isExpired = sql`${rateLimits.windowStartedAt} <= ${new Date(now.getTime() - windowMs)}`;

  const [row] = await ctx.db
    .insert(rateLimits)
    .values({ bucket: target.bucket, identifier: target.key, attempts: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.identifier],
      set: {
        attempts: sql`case when ${isExpired} then 1 else least(${rateLimits.attempts} + 1, ${bucket.limit + 1}::integer) end`,
        windowStartedAt: sql`case when ${isExpired} then ${now}::timestamptz else ${rateLimits.windowStartedAt} end`,
      },
    })
    .returning();

  if (Math.random() < options.cleanupProbability) {
    await pruneQuietly(ctx);
  }

  const attempts = row?.attempts ?? 1;
  const resetAt = new Date((row?.windowStartedAt ?? now).getTime() + windowMs);
  if (attempts > bucket.limit) {
    const rejection: RateLimitRejection = {
      ...err("security.rate_limited"),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
      resetAt,
    };
    return rejection;
  }
  return ok({ remaining: bucket.limit - attempts, resetAt });
}

/**
 * Forgets the attempts of one key, after an event that proves it is not a flood (a successful
 * login). Not for sign-ups: there, success is exactly what a flood is after.
 */
export async function resetRateLimit(ctx: SecurityContext, target: RateLimitTarget): Promise<void> {
  getBucket(getSecurityOptions(ctx.config), target.bucket);
  assertKey(target.key);
  await ctx.db.delete(rateLimits).where(and(eq(rateLimits.bucket, target.bucket), eq(rateLimits.identifier, target.key)));
}

/**
 * Deletes rows whose window ended long ago: per bucket after two of its windows, and rows of
 * buckets no longer configured after two of the longest window. `consumeRateLimit` calls it now
 * and then; an app may also call it from a scheduled job.
 */
export async function pruneRateLimits(ctx: SecurityContext): Promise<void> {
  const options = getSecurityOptions(ctx.config);
  const now = ctx.clock.now().getTime();
  const buckets = Object.entries(options.buckets);
  const cutoff = (windowMinutes: number) => new Date(now - CLEANUP_AFTER_WINDOWS * windowMinutes * MINUTE_MS);
  const longestWindow = Math.max(...buckets.map(([, bucket]) => bucket.windowMinutes));

  await ctx.db
    .delete(rateLimits)
    .where(
      or(
        ...buckets.map(([name, bucket]) =>
          and(eq(rateLimits.bucket, name), lt(rateLimits.windowStartedAt, cutoff(bucket.windowMinutes))),
        ),
        and(
          notInArray(
            rateLimits.bucket,
            buckets.map(([name]) => name),
          ),
          lt(rateLimits.windowStartedAt, cutoff(longestWindow)),
        ),
      ),
    );
}

async function pruneQuietly(ctx: SecurityContext): Promise<void> {
  try {
    await pruneRateLimits(ctx);
  } catch (error) {
    console.error(`@softure-ai/security: rate limit cleanup failed: ${errorLogLabel(error)}`);
  }
}

function assertKey(key: string): void {
  if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
    throw new RangeError(
      `@softure-ai/security: a rate limit key must have 1 to ${String(MAX_KEY_LENGTH)} characters, got ${String(key.length)}`,
    );
  }
}
