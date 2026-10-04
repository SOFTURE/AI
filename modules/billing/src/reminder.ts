// Which reminder mail an account is due, as a pure rule: the four states the in-app notice shows
// (trial or paid access ending, trial or paid access ended), decided from the account's record by
// the state machine. An ended mail is due only for a few days after the end, so turning reminders
// on never mails every account that lapsed long ago.
import { getDayNumber } from "./calendar.js";
import type { EntitlementRecord } from "./contract.js";
import { resolveEntitlement, type EntitlementPolicy } from "./entitlement.js";

export const ACCESS_REMINDER_KINDS = ["trial-ending", "paid-ending", "trial-ended", "paid-ended"] as const;
export type AccessReminderKind = (typeof ACCESS_REMINDER_KINDS)[number];

/** The longest catch-up window for ended mails, in days. */
export const MAX_CATCH_UP_DAYS = 365;
/** Days after the day access ended during which its ended mail is still due. */
export const DEFAULT_CATCH_UP_DAYS = 3;

export interface AccessReminder {
  readonly kind: AccessReminderKind;
  /** The first instant without the access the mail is about. */
  readonly endsAt: Date;
}

export interface AccessReminderInput {
  readonly record: EntitlementRecord;
  /** `auth.users.created_at`: a trial that ended by then was never a trial. */
  readonly accountCreatedAt: Date;
  readonly now: Date;
  readonly policy: EntitlementPolicy;
  /** An ended mail is due from the day access ended through this many local days after it. */
  readonly catchUpDays: number;
}

/** The reminder `input.record` is due at `input.now`, or null (lifetime, outside every window). */
export function getAccessReminder(input: AccessReminderInput): AccessReminder | null {
  const { record, accountCreatedAt, now, policy, catchUpDays } = input;
  const entitlement = resolveEntitlement(record, now, policy);
  if (entitlement.status !== "read_only") {
    if (!entitlement.isEnding || entitlement.endsAt === null) return null;
    return { kind: entitlement.status === "trial" ? "trial-ending" : "paid-ending", endsAt: entitlement.endsAt };
  }
  if (getDayNumber(now, policy.timezone) - getDayNumber(entitlement.since, policy.timezone) > catchUpDays) return null;
  if (entitlement.reason === "paid_ended") return { kind: "paid-ended", endsAt: entitlement.since };
  return entitlement.since > accountCreatedAt ? { kind: "trial-ended", endsAt: entitlement.since } : null;
}

/**
 * The delivery scope of a reminder in `mailing.deliveries`: one mail per account, kind and end, so
 * a new end (an extended trial, a renewal, a refund) is a new window and the same end never mails twice.
 */
export function getAccessReminderScope(kind: AccessReminderKind, userId: string, endsAt: Date): string {
  return `billing.${kind}:${userId}:${String(endsAt.getTime())}`;
}
