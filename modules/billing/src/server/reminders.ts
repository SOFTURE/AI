// The accounts due a reminder mail now. Two bounded range queries find the candidates: stored rows
// whose trial or dated paid access ends inside the widest window, and accounts without a row whose
// derived trial does (its end day is the creation day plus `trial.days`, so the window is a range
// on `auth.users.created_at`, indexed by auth, plus every account under `trial.startsAt` when the
// floor's trial ends in it). The pure rule then decides each candidate exactly,
// so the ranges only need to be wide enough, never exact. Each stored end is also read in
// microseconds, which a `Date` drops, so an app can rebuild a scope it computed in SQL.
import { users } from "@softure-ai/auth";
import { and, asc, eq, gte, isNull, lt, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { getDayNumber, getStartOfDay } from "../calendar.js";
import type { EntitlementRecord } from "../contract.js";
import { DEFAULT_CATCH_UP_DAYS, getAccessReminder, MAX_CATCH_UP_DAYS, type AccessReminder, type AccessReminderKind } from "../reminder.js";
import { entitlements } from "../schema.js";
import { getDefaultRecord, getTrialFloorDay, type BillingContext } from "./entitlements.js";
import { getBillingOptions, getEntitlementPolicy } from "./options.js";

export interface FindAccessRemindersOptions {
  /** An ended mail is due from the day access ended through this many local days after it. Default 3. */
  readonly catchUpDays?: number;
}

export interface AccessReminderDue {
  readonly userId: string;
  readonly email: string;
  readonly kind: AccessReminderKind;
  /** The first instant without the access the mail is about. */
  readonly endsAt: Date;
  /**
   * `endsAt` exactly as stored: microseconds since the Unix epoch, as a decimal string. It equals
   * `(extract(epoch from <column>) * 1000000)::bigint::text` on the column the end comes from (Postgres 14 or
   * later), so an app can rebuild a delivery scope its own job computed in SQL. A derived trial end (no stored
   * row) has no microseconds: `endsAt` times 1000.
   */
  readonly endsAtMicros: string;
}

/** A stored end in microseconds, exactly as the column holds it. */
interface StoredEnds {
  readonly trialEndsAtMicros: string | null;
  readonly paidUntilMicros: string | null;
}

interface Candidate {
  readonly userId: string;
  readonly email: string;
  readonly createdAt: Date;
  readonly record: EntitlementRecord;
  readonly storedEnds: StoredEnds | null;
}

const MICROS_PER_MS = 1000n;

/**
 * Every account due a reminder at the clock's now, ordered by end, then account. Reads only.
 * Throws for a `catchUpDays` that is not an integer from 0 to 365 (a caller bug); database errors
 * propagate.
 */
export async function findAccessReminders(ctx: BillingContext, options: FindAccessRemindersOptions = {}): Promise<AccessReminderDue[]> {
  const catchUpDays = options.catchUpDays ?? DEFAULT_CATCH_UP_DAYS;
  if (!Number.isInteger(catchUpDays) || catchUpDays < 0 || catchUpDays > MAX_CATCH_UP_DAYS) {
    throw new Error(`@softure-ai/billing: catchUpDays must be an integer from 0 to ${String(MAX_CATCH_UP_DAYS)}, got ${String(catchUpDays)}`);
  }
  const now = ctx.clock.now();
  const policy = getEntitlementPolicy(ctx.config);
  const candidates = [...(await findStoredCandidates(ctx, now, catchUpDays)), ...(await findDerivedCandidates(ctx, now, catchUpDays))];

  const due: AccessReminderDue[] = [];
  for (const candidate of candidates) {
    const reminder = getAccessReminder({ record: candidate.record, accountCreatedAt: candidate.createdAt, now, policy, catchUpDays });
    if (reminder !== null) due.push({ userId: candidate.userId, email: candidate.email, ...reminder, endsAtMicros: getEndsAtMicros(reminder, candidate.storedEnds) });
  }
  return due.sort((first, second) => first.endsAt.getTime() - second.endsAt.getTime() || first.userId.localeCompare(second.userId));
}

/** A timestamptz column in microseconds since the epoch, as text (`bigint` passes a JS number's exact range). */
function selectEpochMicros(column: AnyColumn): SQL<string | null> {
  return sql<string | null>`(extract(epoch from ${column}) * 1000000)::bigint::text`;
}

/**
 * The stored end the reminder is about (the trial end for a trial mail, the paid end for a paid one), when it lies
 * within a millisecond of `endsAt` (the driver may round a microsecond end either way); otherwise `endsAt` in µs.
 */
function getEndsAtMicros(reminder: AccessReminder, storedEnds: StoredEnds | null): string {
  const fromDate = BigInt(reminder.endsAt.getTime()) * MICROS_PER_MS;
  const stored = reminder.kind.startsWith("trial-") ? storedEnds?.trialEndsAtMicros : storedEnds?.paidUntilMicros;
  if (stored === null || stored === undefined) return String(fromDate);
  const difference = BigInt(stored) - fromDate;
  return difference > -MICROS_PER_MS && difference < MICROS_PER_MS ? stored : String(fromDate);
}

/** Stored rows without lifetime whose trial or paid end lies from the catch-up start to past the widest reminder window. */
async function findStoredCandidates(ctx: BillingContext, now: Date, catchUpDays: number): Promise<Candidate[]> {
  const { timezone } = ctx.config;
  const { trial, paid } = getBillingOptions(ctx.config);
  const today = getDayNumber(now, timezone);
  const from = getStartOfDay(today - catchUpDays, timezone);
  const to = getStartOfDay(today + Math.max(trial.reminderDays, paid.reminderDays) + 1, timezone);
  const rows = await ctx.db
    .select({
      userId: users.id,
      email: users.email,
      createdAt: users.createdAt,
      trialEndsAt: entitlements.trialEndsAt,
      paidUntil: entitlements.paidUntil,
      isLifetime: entitlements.isLifetime,
      trialEndsAtMicros: selectEpochMicros(entitlements.trialEndsAt),
      paidUntilMicros: selectEpochMicros(entitlements.paidUntil),
    })
    .from(entitlements)
    .innerJoin(users, eq(users.id, entitlements.userId))
    .where(
      and(
        eq(entitlements.isLifetime, false),
        or(and(gte(entitlements.trialEndsAt, from), lt(entitlements.trialEndsAt, to)), and(gte(entitlements.paidUntil, from), lt(entitlements.paidUntil, to))),
      ),
    )
    .orderBy(asc(users.id));
  return rows.map(({ trialEndsAt, paidUntil, isLifetime, trialEndsAtMicros, paidUntilMicros, ...account }) => ({
    ...account,
    record: { trialEndsAt, paidUntil, isLifetime },
    storedEnds: { trialEndsAtMicros, paidUntilMicros },
  }));
}

/**
 * Accounts without a row whose derived trial ends in the same span: a trial ends at the start of
 * the creation day plus `trial.days`, so the span moves back by `trial.days` onto `created_at`.
 * Under `trial.startsAt` every account created before the floor day shares one trial end; when that
 * end lies in the span, they are all candidates.
 */
async function findDerivedCandidates(ctx: BillingContext, now: Date, catchUpDays: number): Promise<Candidate[]> {
  const { timezone } = ctx.config;
  const { trial } = getBillingOptions(ctx.config);
  const today = getDayNumber(now, timezone);
  const from = getStartOfDay(today - catchUpDays - trial.days, timezone);
  const to = getStartOfDay(today + trial.reminderDays + 1 - trial.days, timezone);
  let createdInSpan: SQL | undefined = and(gte(users.createdAt, from), lt(users.createdAt, to));
  const floorDay = getTrialFloorDay(ctx);
  if (floorDay !== null) {
    const floorEndDay = floorDay + trial.days;
    if (floorEndDay >= today - catchUpDays && floorEndDay <= today + trial.reminderDays) {
      createdInSpan = or(createdInSpan, lt(users.createdAt, getStartOfDay(floorDay, timezone)));
    }
  }
  const rows = await ctx.db
    .select({ userId: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .where(and(isNull(entitlements.userId), createdInSpan))
    .orderBy(asc(users.id));
  return rows.map((account) => ({ ...account, record: getDefaultRecord(ctx, account.createdAt), storedEnds: null }));
}
