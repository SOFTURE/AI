// The entitlement state machine, pure: a record and an instant give the status, and an event gives
// the next record. No database and no clock here, so every transition is a plain unit test.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { getDaysLeft } from "./calendar.js";
import type { BillingErrorCode, Entitlement, EntitlementEvent, EntitlementRecord } from "./contract.js";

export interface EntitlementPolicy {
  /** The app's IANA time zone: days left are counted there. */
  readonly timezone: string;
  /** From how many days left a trial counts as ending; 0 never. */
  readonly trialReminderDays: number;
  /** From how many days left paid access counts as ending; 0 never. */
  readonly paidReminderDays: number;
}

/**
 * The status of `record` at `now`. Paid access wins over the trial; access covers instants before
 * its end, so at the end itself the account is read-only.
 */
export function resolveEntitlement(record: EntitlementRecord, now: Date, policy: EntitlementPolicy): Entitlement {
  if (record.isLifetime) return { status: "paid", endsAt: null, daysLeft: null, isEnding: false };
  if (record.paidUntil !== null && now < record.paidUntil) {
    const daysLeft = getDaysLeft(record.paidUntil, now, policy.timezone);
    return { status: "paid", endsAt: record.paidUntil, daysLeft, isEnding: daysLeft <= policy.paidReminderDays };
  }
  if (now < record.trialEndsAt) {
    const daysLeft = getDaysLeft(record.trialEndsAt, now, policy.timezone);
    return { status: "trial", endsAt: record.trialEndsAt, daysLeft, isEnding: daysLeft <= policy.trialReminderDays };
  }
  if (record.paidUntil !== null && record.paidUntil > record.trialEndsAt) return { status: "read_only", since: record.paidUntil, reason: "paid_ended" };
  return { status: "read_only", since: record.trialEndsAt, reason: "trial_ended" };
}

/** Whether an account in this state may write. */
export function hasWriteAccess(entitlement: Entitlement): boolean {
  return entitlement.status !== "read_only";
}

/** The later of two instants. */
function getLater(first: Date, second: Date): Date {
  return first > second ? first : second;
}

/** The earlier of two instants. */
function getEarlier(first: Date, second: Date): Date {
  return first < second ? first : second;
}

/**
 * The record after `event` at `now`. Grants and trial extensions must end after `now` and never
 * shorten what the account already has; an import never shortens either, but may record past ends;
 * a revoke ends paid access, lifetime included. The dated end lives on under lifetime access: a
 * grant still extends it, and ending lifetime falls back to it.
 */
export function applyEntitlementEvent(record: EntitlementRecord, event: EntitlementEvent, now: Date): Ok<EntitlementRecord> | Err<BillingErrorCode> {
  switch (event.type) {
    case "grant": {
      if (event.until <= now) return err("billing.end_not_in_future");
      const paidUntil = record.paidUntil === null ? event.until : getLater(record.paidUntil, event.until);
      return ok({ ...record, paidUntil });
    }
    case "grant_lifetime":
      return ok({ ...record, isLifetime: true });
    case "revoke":
      return ok({ ...record, paidUntil: null, isLifetime: false });
    case "shorten": {
      if (record.paidUntil === null) return ok(record);
      const paidUntil = getEarlier(record.paidUntil, event.until);
      // Paid access that would end inside the trial adds nothing: the account is back on its trial.
      return ok({ ...record, paidUntil: paidUntil > record.trialEndsAt ? paidUntil : null });
    }
    case "end_lifetime":
      return ok({ ...record, isLifetime: false });
    case "extend_trial":
      if (event.until <= now) return err("billing.end_not_in_future");
      return ok({ ...record, trialEndsAt: getLater(record.trialEndsAt, event.until) });
    case "import":
      return ok({
        trialEndsAt: event.trialEndsAt === null ? record.trialEndsAt : getLater(record.trialEndsAt, event.trialEndsAt),
        paidUntil: event.paidUntil === null || (record.paidUntil !== null && record.paidUntil >= event.paidUntil) ? record.paidUntil : event.paidUntil,
        isLifetime: record.isLifetime || event.isLifetime,
      });
  }
}
