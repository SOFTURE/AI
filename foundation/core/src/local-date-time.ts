// A local wall-clock date-time, `YYYY-MM-DDTHH:mm` with no time zone: a time that is local at a place
// (a departure, a booking slot), independent of the server's zone. Zero-padded, so it sorts as text.
import { z } from "zod";
import { isCalendarDay } from "./calendar-day.js";

const LOCAL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d$/;

/** A string checked by `isLocalDateTime` or `localDateTimeSchema`; a plain string is not one. */
export type LocalDateTime = string & z.$brand<"LocalDateTime">;

/** Whether `value` is a `YYYY-MM-DDTHH:mm` local date-time on a real day (`2026-02-30T10:00` and `…T24:00` are not). */
export function isLocalDateTime(value: unknown): value is LocalDateTime {
  if (typeof value !== "string") return false;
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  return match !== null && isCalendarDay(match[1]);
}

/** A `YYYY-MM-DDTHH:mm` local date-time in tool and form input, parsed into the branded `LocalDateTime`. */
export const localDateTimeSchema = z
  .string()
  .refine(isLocalDateTime, "must be a YYYY-MM-DDTHH:mm local date-time on a real day, e.g. 2026-10-04T09:30")
  .brand<"LocalDateTime">();

/** The calendar day (`YYYY-MM-DD`) of a local date-time. Throws a `RangeError` for a malformed value. */
export function getLocalDay(value: LocalDateTime): string {
  if (!isLocalDateTime(value)) {
    throw new RangeError(`getLocalDay: "${String(value)}" is not a YYYY-MM-DDTHH:mm local date-time`);
  }
  return value.slice(0, "YYYY-MM-DD".length);
}
