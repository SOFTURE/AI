// Calendar arithmetic in an IANA time zone through `Intl`, with no date library. An invalid zone is
// a programming error (core validates the app's `timezone` at startup), so `Intl`'s RangeError
// propagates.

const MS_PER_DAY = 86_400_000;

/** A calendar date: month 1-12, day 1-31. */
export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The wall clock of an instant in a zone, read as if it were UTC (milliseconds). */
function getWallClock(instant: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const part of getFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const { year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0 } = parts;
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

/** The zone's offset from UTC at an instant, in milliseconds (positive east of Greenwich). */
function getOffset(instant: number, timeZone: string): number {
  return getWallClock(Math.floor(instant / 1000) * 1000, timeZone) - Math.floor(instant / 1000) * 1000;
}

/** The calendar date of an instant in a zone. */
export function getCalendarDate(instant: Date, timeZone: string): CalendarDate {
  const wall = new Date(getWallClock(instant.getTime(), timeZone));
  return { year: wall.getUTCFullYear(), month: wall.getUTCMonth() + 1, day: wall.getUTCDate() };
}

/**
 * The instant of local midnight on a calendar date. Month and day may overflow (month 13 is the next
 * January), as in `Date.UTC`. Midnight inside a DST gap resolves to the first instant after the gap.
 */
export function getZonedMidnight({ year, month, day }: CalendarDate, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, day);
  const firstGuess = wall - getOffset(wall, timeZone);
  // One correction: the offset at the guess may differ from the offset at local midnight when a
  // DST change falls between them.
  const corrected = wall - getOffset(firstGuess, timeZone);
  if (getWallClock(corrected, timeZone) >= wall) return new Date(corrected);
  // Midnight does not exist that day: take the later offset, the first valid instant after it.
  return new Date(Math.max(firstGuess, corrected));
}

/** Days since 1970-01-01 of a calendar date (a civil day count, no time zone). */
export function toDayNumber({ year, month, day }: CalendarDate): number {
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/** The calendar date of a civil day count. */
export function fromDayNumber(dayNumber: number): CalendarDate {
  const date = new Date(dayNumber * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
