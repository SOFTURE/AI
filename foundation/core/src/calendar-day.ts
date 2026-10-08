// The calendar day of an instant in a given IANA time zone, as `YYYY-MM-DD`. "Today" computed in the
// process zone is a classic date bug: on a server in UTC, an evening in New York is already tomorrow.
import type { Clock } from "./clock.js";

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day (`YYYY-MM-DD`) of `instant` in `timeZone`. Throws a `RangeError` for an invalid date or zone. */
export function toCalendarDay(instant: Date, timeZone: string): string {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("toCalendarDay: invalid date");
  }
  // Parts, not the formatted string: a locale's date pattern (`en-CA`) has changed between ICU versions.
  const parts = getFormatter(timeZone).formatToParts(instant);
  const readPart = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${readPart("year").padStart(4, "0")}-${readPart("month")}-${readPart("day")}`;
}

/** Today's calendar day (`YYYY-MM-DD`) in `timeZone`, read from `clock`. */
export function getCalendarDay(clock: Clock, timeZone: string): string {
  return toCalendarDay(clock.now(), timeZone);
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone);
  if (format === undefined) {
    format = createFormatter(timeZone);
    formatters.set(timeZone, format);
  }
  return format;
}

function createFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch (error) {
    throw new RangeError(`toCalendarDay: "${timeZone}" is not an IANA time zone`, { cause: error });
  }
}
