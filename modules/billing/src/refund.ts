// Refunds, pure: what one payment of a plan added to an account (stored with the payment) and the
// change a refund of it makes. A full refund takes back the part of the payment's period not used
// yet. Access ahead of now is one unbroken run (every grant starts where running access ends), so
// taking back those days moves the dated end back by as many local days; a period already used up
// takes nothing back, and a lapse between payments never lets an old refund eat a new period.
// A partial refund takes back the same share of those days as the share of the money not refunded
// before that it returns, rounded down: the refund that completes the amount has a share of one, so
// partial refunds that add up to the whole payment take back what one full refund would.
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
export function moveBackByDays(instant: Date, days: number, timezone: string): Date {
  const day = getDayNumber(instant, timezone);
  const timeOfDay = instant.getTime() - getStartOfDay(day, timezone).getTime();
  return new Date(getStartOfDay(day - days, timezone).getTime() + timeOfDay);
}

/**
 * The local days of a period not used yet at `now`, `[max(from, now), until)`, today included; 0
 * once the period has ended. A refund moves dated access, and every period stacked after this one,
 * back by this many days.
 */
export function getUnusedDays(grant: Extract<PaymentGrant, { kind: "period" }>, now: Date, timezone: string): number {
  if (grant.until <= now) return 0;
  return Math.max(0, getDayNumber(grant.until, timezone) - getDayNumber(getLater(grant.from, now), timezone));
}

/** The part of a payment a refund returns: `refunded` newly refunded out of the `outstanding` amount not refunded before. */
export interface RefundShare {
  readonly refunded: number;
  readonly outstanding: number;
}

export interface RefundTiming {
  readonly now: Date;
  readonly timezone: string;
  /** The part of the payment refunded; omitted for a full refund. */
  readonly share?: RefundShare;
}

/** Whether `share` returns everything not refunded before (or is absent: a full refund). */
export function isFullShare(share: RefundShare | undefined): boolean {
  return share === undefined || share.refunded >= share.outstanding;
}

/**
 * The local days a refund takes back from a period: all its unused days (`getUnusedDays`) for a
 * full share, else that share of them rounded down, so the account keeps any part of a day.
 */
export function getTakenBackDays(grant: Extract<PaymentGrant, { kind: "period" }>, timing: RefundTiming): number {
  const unusedDays = getUnusedDays(grant, timing.now, timing.timezone);
  const { share } = timing;
  if (share === undefined || isFullShare(share)) return unusedDays;
  if (share.refunded <= 0) return 0;
  // Integers: at most 10^8 minor units times a period's days stays a safe integer.
  return Math.floor((unusedDays * share.refunded) / share.outstanding);
}

/**
 * The change a refund of a payment that granted `grant` makes to `record`: a period moves dated
 * paid access back by the days it takes back (`getTakenBackDays`), and a full refund of a lifetime
 * ends lifetime access. Null when nothing is taken back (the period is used up, the share rounds to
 * no day, a partial refund of a lifetime, or dated access is already gone).
 */
export function getRefundEvent(record: EntitlementRecord, grant: PaymentGrant, timing: RefundTiming): EntitlementEvent | null {
  if (grant.kind === "lifetime") return isFullShare(timing.share) ? { type: "end_lifetime" } : null;
  const days = getTakenBackDays(grant, timing);
  if (record.paidUntil === null || days === 0) return null;
  return { type: "shorten", until: moveBackByDays(record.paidUntil, days, timing.timezone) };
}
