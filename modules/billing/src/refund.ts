// Refunds, pure: what one payment of a plan added to an account (stored with the payment) and the
// change a full refund of it makes. A refund takes back the part of the payment's period not used
// yet. Access ahead of now is one unbroken run (every grant starts where running access ends), so
// taking back those days moves the dated end back by as many local days; a period already used up
// takes nothing back, and a lapse between payments never lets an old refund eat a new period.
import { getDayNumber, getStartOfDay } from "./calendar.js";
import type { EntitlementEvent, EntitlementRecord, PaymentGrant } from "./contract.js";

/** The later of two instants. */
function getLater(first: Date, second: Date): Date {
  return first > second ? first : second;
}

/**
 * What a plan's event added to `record`: the period from where access ended (the trial, dated paid
 * access or `now`, as `getPlanGrant` starts it) to the event's end, or lifetime access. Null for an
 * event that is not a plan grant.
 */
export function getPaymentGrant(record: EntitlementRecord, event: EntitlementEvent, now: Date): PaymentGrant | null {
  switch (event.type) {
    case "grant_lifetime":
      return { kind: "lifetime" };
    case "grant": {
      const from = [record.trialEndsAt, ...(record.paidUntil === null ? [] : [record.paidUntil])].reduce(getLater, now);
      return from < event.until ? { kind: "period", from, until: event.until } : null;
    }
    default:
      return null;
  }
}

/**
 * `instant` moved back by `days` local days in `timezone`, at the same local time of day (the first
 * instant of the day when that time does not exist there).
 */
function moveBackByDays(instant: Date, days: number, timezone: string): Date {
  const day = getDayNumber(instant, timezone);
  const timeOfDay = instant.getTime() - getStartOfDay(day, timezone).getTime();
  return new Date(getStartOfDay(day - days, timezone).getTime() + timeOfDay);
}

/**
 * The change a full refund of a payment that granted `grant` makes to `record` at `now`: a period
 * moves dated paid access back by the local days of its unused part, `[max(from, now), until)`, and
 * a lifetime ends lifetime access. Null when nothing is left to take back (the period is used up,
 * or dated access is already gone).
 */
export function getRefundEvent(record: EntitlementRecord, grant: PaymentGrant, now: Date, timezone: string): EntitlementEvent | null {
  if (grant.kind === "lifetime") return { type: "end_lifetime" };
  if (record.paidUntil === null || grant.until <= now) return null;
  const unusedDays = getDayNumber(grant.until, timezone) - getDayNumber(getLater(grant.from, now), timezone);
  if (unusedDays <= 0) return null;
  return { type: "shorten", until: moveBackByDays(record.paidUntil, unusedDays, timezone) };
}
