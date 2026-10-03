// Plans from `billing({ plans })`, pure: how long a payment of a plan gives access and the change it
// makes to an entitlement. Periods run in local calendar days, like trials, so a month bought on
// 3 October covers every day up to 2 November and ends when 3 November begins in the app's time zone.
import type { Locale } from "@softure-ai/core";
import { getDayNumber, getStartOfDay } from "./calendar.js";
import type { EntitlementEvent, EntitlementRecord, LocalizedText, Plan, PlanPeriod } from "./contract.js";

const DAY_MS = 24 * 60 * 60 * 1000;
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

/** A day number `months` calendar months later; a day the target month lacks becomes its last day. */
function addMonths(dayNumber: number, months: number): number {
  const date = new Date(dayNumber * DAY_MS);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.floor(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)) / DAY_MS);
}

/**
 * The end of one period begun at `start`: the start of the local day one period after the start
 * day. The start day counts as the first day, as for trials. Lifetime periods have no end.
 */
export function getPeriodEnd(start: Date, period: Exclude<PlanPeriod, { unit: "lifetime" }>, timezone: string): Date {
  const day = getDayNumber(start, timezone);
  switch (period.unit) {
    case "day":
      return getStartOfDay(day + period.count, timezone);
    case "week":
      return getStartOfDay(day + period.count * DAYS_PER_WEEK, timezone);
    case "month":
      return getStartOfDay(addMonths(day, period.count), timezone);
    case "year":
      return getStartOfDay(addMonths(day, period.count * MONTHS_PER_YEAR), timezone);
  }
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
