// Dates and day counts of an entitlement as the components show them. An end is the first instant
// without access, so the date shown is the last day with it, in the app's time zone.
import { formatMessage, selectPlural, type Locale } from "@softure-ai/core";
import type { BillingMessages } from "../messages/index.js";

/** The last local day covered by an access that ends at `end`, e.g. "October 16, 2026" in en. */
export function formatLastDay(end: Date, locale: Locale, timezone: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: timezone }).format(new Date(end.getTime() - 1));
}

export function formatDaysLeft(days: number, locale: Locale, messages: BillingMessages): string {
  return formatMessage(selectPlural(locale, days, messages.badge.daysLeft), { count: days });
}
