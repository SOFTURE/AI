// Dates and day counts of an entitlement as the components show them. An end is the first instant
// without access, so the date shown is the last day with it, in the app's time zone.
import { formatCalendarDay, formatMessage, selectPlural, toCalendarDay, type Locale } from "@softure-ai/core";
import type { PlanPeriod } from "../contract.js";
import type { BillingMessages } from "../messages/index.js";

/** The last local day covered by an access that ends at `end`, e.g. "October 16, 2026" in en. */
export function formatLastDay(end: Date, locale: Locale, timezone: string): string {
  return formatDay(new Date(end.getTime() - 1), locale, timezone);
}

/** The local day of an instant, e.g. "October 3, 2026" in en: when something happened, or a first day of access. */
export function formatDay(instant: Date, locale: Locale, timezone: string): string {
  return formatCalendarDay(toCalendarDay(instant, timezone), locale, "long");
}

/** The numeric form of `formatLastDay` for compact places, e.g. "22.11.2026" in pl, "11/22/2026" in en. */
export function formatShortLastDay(end: Date, locale: Locale, timezone: string): string {
  return formatShortDay(new Date(end.getTime() - 1), locale, timezone);
}

/** The numeric form of `formatDay` for compact places, e.g. "22.11.2026" in pl, "11/22/2026" in en. */
export function formatShortDay(instant: Date, locale: Locale, timezone: string): string {
  return formatCalendarDay(toCalendarDay(instant, timezone), locale, "numeric");
}

/** The days left as the badge says them: "5 days left". */
export function formatDaysLeft(days: number, locale: Locale, messages: BillingMessages): string {
  return formatMessage(selectPlural(locale, days, messages.badge.daysLeft), { count: days });
}

/** A bare count of days for the app's own sentences ("Trial ends in 5 days"): "5 days", from `messages.dayCount`. */
export function formatDayCount(days: number, locale: Locale, messages: BillingMessages): string {
  // The count in the locale's digits, so a fraction reads "1,5" in pl.
  return formatMessage(selectPlural(locale, days, messages.dayCount), { count: new Intl.NumberFormat(locale).format(days) });
}

/** How long one payment lasts, as the tiles say it: "per month", "per 3 months", "one-time payment". */
export function formatPeriod(period: PlanPeriod, locale: Locale, messages: BillingMessages): string {
  if (period.unit === "lifetime") return messages.pricing.period.lifetime;
  return formatMessage(selectPlural(locale, period.count, messages.pricing.period[period.unit]), { count: period.count });
}
