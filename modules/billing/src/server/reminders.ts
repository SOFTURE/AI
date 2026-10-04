// The accounts due a reminder mail now. Two bounded range queries find the candidates: stored rows
// whose trial or dated paid access ends inside the widest window, and accounts without a row whose
// derived trial does (its end day is the creation day plus `trial.days`, so the window is a range
// on `auth.users.created_at`, indexed by auth). The pure rule then decides each candidate exactly,
// so the ranges only need to be wide enough, never exact.
import { users } from "@softure-ai/auth";
import { and, asc, eq, gte, isNull, lt, or } from "drizzle-orm";
import { getDayNumber, getStartOfDay } from "../calendar.js";
import type { EntitlementRecord } from "../contract.js";
import { DEFAULT_CATCH_UP_DAYS, getAccessReminder, MAX_CATCH_UP_DAYS, type AccessReminderKind } from "../reminder.js";
import { entitlements } from "../schema.js";
import { getDefaultRecord, type BillingContext } from "./entitlements.js";
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
}

interface Candidate {
  readonly userId: string;
  readonly email: string;
  readonly createdAt: Date;
  readonly record: EntitlementRecord;
}

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
    if (reminder !== null) due.push({ userId: candidate.userId, email: candidate.email, ...reminder });
  }
  return due.sort((first, second) => first.endsAt.getTime() - second.endsAt.getTime() || first.userId.localeCompare(second.userId));
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
  return rows.map(({ trialEndsAt, paidUntil, isLifetime, ...account }) => ({ ...account, record: { trialEndsAt, paidUntil, isLifetime } }));
}

/**
 * Accounts without a row whose derived trial ends in the same span: a trial ends at the start of
 * the creation day plus `trial.days`, so the span moves back by `trial.days` onto `created_at`.
 */
async function findDerivedCandidates(ctx: BillingContext, now: Date, catchUpDays: number): Promise<Candidate[]> {
  const { timezone } = ctx.config;
  const { trial } = getBillingOptions(ctx.config);
  const today = getDayNumber(now, timezone);
  const from = getStartOfDay(today - catchUpDays - trial.days, timezone);
  const to = getStartOfDay(today + trial.reminderDays + 1 - trial.days, timezone);
  const rows = await ctx.db
    .select({ userId: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .where(and(isNull(entitlements.userId), gte(users.createdAt, from), lt(users.createdAt, to)))
    .orderBy(asc(users.id));
  return rows.map((account) => ({ ...account, record: getDefaultRecord(ctx, account.createdAt) }));
}
