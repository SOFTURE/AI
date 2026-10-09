// Dates on the token page, in the app's locale and time zone.
import { formatCalendarDay, toCalendarDay, type SoftureConfig } from "@softure-ai/core";

export function formatDate(config: SoftureConfig, date: Date): string {
  return formatCalendarDay(toCalendarDay(date, config.timezone), config.locale, "long");
}

export function formatDateTime(config: SoftureConfig, date: Date): string {
  return new Intl.DateTimeFormat(config.locale, { dateStyle: "medium", timeStyle: "short", timeZone: config.timezone }).format(date);
}
