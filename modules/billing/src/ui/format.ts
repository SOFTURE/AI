// Dates and day counts of an entitlement as the components show them. An end is the first instant
// without access, so the date shown is the last day with it, in the app's time zone.
import { formatMessage, selectPlural, type Locale } from "@softure-ai/core";
import type { PlanPeriod } from "../contract.js";
import type { BillingMessages } from "../messages/index.js";

/** The last local day covered by an access that ends at `end`, e.g. "October 16, 2026" in en. */
export function formatLastDay(end: Date, locale: Locale, timezone: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: timezone }).format(new Date(end.getTime() - 1));
}

export function formatDaysLeft(days: number, locale: Locale, messages: BillingMessages): string {
  return formatMessage(selectPlural(locale, days, messages.badge.daysLeft), { count: days });
}

/** How long one payment lasts, as the tiles say it: "per month", "per 3 months", "one-time payment". */
export function formatPeriod(period: PlanPeriod, locale: Locale, messages: BillingMessages): string {
  if (period.unit === "lifetime") return messages.pricing.period.lifetime;
  return formatMessage(selectPlural(locale, period.count, messages.pricing.period[period.unit]), { count: period.count });
}
