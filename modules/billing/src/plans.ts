// Plans from `billing({ plans })`, pure: how long a payment of a plan gives access and the change it
// makes to an entitlement. Periods run in local calendar days, like trials, so a month bought on
// 3 October covers every day up to 2 November and ends when 3 November begins in the app's time zone.
import { addCalendarDays, addCalendarMonths, toCalendarDay, type Locale } from "@softure-ai/core";
import { getStartOfDay, parseDay } from "./calendar.js";
import type { EntitlementEvent, EntitlementRecord, LocalizedText, Plan, PlanPeriod } from "./contract.js";

const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

/** The text in `locale`, else the `en` text (the options require one). */
export function getLocalizedText(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en ?? "";
}

/** The plan with this id, or undefined. */
export function findPlan(plans: readonly Plan[], planId: string): Plan | undefined {
  return plans.find((plan) => plan.id === planId);
}

/**
 * The end of one period begun at `start`: the start of the local day one period after the start
 * day. The start day counts as the first day, as for trials. Lifetime periods have no end.
 */
export function getPeriodEnd(start: Date, period: Exclude<PlanPeriod, { unit: "lifetime" }>, timezone: string): Date {
  return getStartOfDay(toDayNumber(getEndDay(toCalendarDay(start, timezone), period)), timezone);
}

/** The calendar day one period after `day`; a month end the target month lacks becomes its last day. */
function getEndDay(day: string, period: Exclude<PlanPeriod, { unit: "lifetime" }>): string {
  switch (period.unit) {
    case "day":
      return addCalendarDays(day, period.count);
    case "week":
      return addCalendarDays(day, period.count * DAYS_PER_WEEK);
    case "month":
      return addCalendarMonths(day, period.count, { endOfMonth: "clamp" });
    case "year":
      return addCalendarMonths(day, period.count * MONTHS_PER_YEAR, { endOfMonth: "clamp" });
  }
}

function toDayNumber(day: string): number {
  const dayNumber = parseDay(day);
  // Core's arithmetic returns well-formed days only, so reaching here is a bug.
  if (dayNumber === null) throw new Error(`getPeriodEnd: core returned "${day}", not a calendar day`);
  return dayNumber;
}

/** The latest of some instants. */
function getLatest(first: Date, ...rest: readonly Date[]): Date {
  return rest.reduce((latest, instant) => (instant > latest ? instant : latest), first);
}

/**
 * The change one payment of `plan` makes to `record` at `now`. A paid period starts when the access
 * the account already has ends (a running trial or paid access), so paying early loses no day; a
 * lifetime plan grants lifetime access.
 */
export function getPlanGrant(record: EntitlementRecord, plan: Plan, now: Date, timezone: string): EntitlementEvent {
  if (plan.period.unit === "lifetime") return { type: "grant_lifetime" };
  const start = getLatest(now, record.trialEndsAt, ...(record.paidUntil === null ? [] : [record.paidUntil]));
  return { type: "grant", until: getPeriodEnd(start, plan.period, timezone) };
}
