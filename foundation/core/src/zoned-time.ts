// Wall-clock time in an IANA time zone, and the way back from a calendar day or a local date-time to the
// instant it starts, with the platform's Intl data and no date library.
import { isCalendarDay } from "./calendar-day.js";
import { isLocalDateTime, type LocalDateTime } from "./local-date-time.js";

const HOUR_MS = 60 * 60 * 1000;
const formatters = new Map<string, Intl.DateTimeFormat>();

/** A date and a time of day as a clock in some time zone shows them; `month` counts from 1. */
export interface WallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

/** True when `timeZone` is an IANA zone the runtime knows, such as `Europe/Warsaw` or `UTC`. */
export function isTimeZone(timeZone: string): boolean {
  if (timeZone === "") return false;
  try {
    createFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall clock of `instant` in `timeZone`, to the minute. Throws a `RangeError` for an invalid date or zone. */
export function getWallClock(instant: Date, timeZone: string): WallClock {
  if (Number.isNaN(instant.getTime())) throw new RangeError("getWallClock: invalid date");
  return readWallClock("getWallClock", instant.getTime(), timeZone);
}

/**
 * The instant a clock in `timeZone` shows `wallClock`. A time that occurs twice (the hour a DST change repeats) gives
 * its first occurrence; a time that does not occur (the hour a DST change skips) gives the instant the same distance
 * after the change, so 02:30 on a day that jumps from 02:00 to 03:00 gives 03:30. Throws a `RangeError` for an
 * invalid zone.
 */
export function getZonedInstant(wallClock: WallClock, timeZone: string): Date {
  return new Date(findZonedInstant("getZonedInstant", wallClock, timeZone));
}

/**
 * The instant `day` (`YYYY-MM-DD`) starts in `timeZone`: its first midnight. On a day whose midnight a DST change
 * skips, the instant after the change (01:00 when 00:00 jumps to 01:00). Throws a `RangeError` for a malformed day
 * or an invalid zone.
 */
export function getDayStartInstant(day: string, timeZone: string): Date {
  const operation = "getDayStartInstant";
  if (!isCalendarDay(day)) throw new RangeError(`${operation}: "${String(day)}" is not a YYYY-MM-DD calendar day`);
  const [year, month, date] = day.split("-").map(Number);
  return new Date(findZonedInstant(operation, { year: year ?? 0, month: month ?? 0, day: date ?? 0, hour: 0, minute: 0 }, timeZone));
}

/**
 * The instant a clock in `timeZone` shows the local date-time `value` (`YYYY-MM-DDTHH:mm`), with the DST rules of
 * `getZonedInstant`. Throws a `RangeError` for a malformed value or an invalid zone.
 */
export function getLocalDateTimeInstant(value: LocalDateTime, timeZone: string): Date {
  const operation = "getLocalDateTimeInstant";
  if (!isLocalDateTime(value)) throw new RangeError(`${operation}: "${String(value)}" is not a YYYY-MM-DDTHH:mm local date-time`);
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  const wallClock = { year: year ?? 0, month: month ?? 0, day: day ?? 0, hour: hour ?? 0, minute: minute ?? 0 };
  return new Date(findZonedInstant(operation, wallClock, timeZone));
}

function findZonedInstant(operation: string, wallClock: WallClock, timeZone: string): number {
  const asUtc = toUtcMs(wallClock);
  // One DST change a day at most: the offsets half a day before and after cover both sides of it.
  const offsetBefore = getOffsetMs(operation, asUtc - 12 * HOUR_MS, timeZone);
  const offsetAfter = getOffsetMs(operation, asUtc + 12 * HOUR_MS, timeZone);
  const matching = [asUtc - offsetBefore, asUtc - offsetAfter].filter(
    (instant) => toUtcMs(readWallClock(operation, instant, timeZone)) === asUtc,
  );
  return matching.length > 0 ? Math.min(...matching) : asUtc - offsetBefore;
}

function getOffsetMs(operation: string, instant: number, timeZone: string): number {
  const minute = Math.floor(instant / 60_000) * 60_000;
  return toUtcMs(readWallClock(operation, minute, timeZone)) - minute;
}

function readWallClock(operation: string, instant: number, timeZone: string): WallClock {
  const parts = Object.fromEntries(getFormatter(operation, timeZone).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function toUtcMs(wallClock: WallClock): number {
  // Not `Date.UTC`: it reads years 0-99 as 1900-1999.
  const date = new Date(0);
  date.setUTCFullYear(wallClock.year, wallClock.month - 1, wallClock.day);
  date.setUTCHours(wallClock.hour, wallClock.minute, 0, 0);
  return date.getTime();
}

function getFormatter(operation: string, timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (formatter === undefined) {
    try {
      formatter = createFormatter(timeZone);
    } catch (error) {
      throw new RangeError(`${operation}: "${timeZone}" is not an IANA time zone`, { cause: error });
    }
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function createFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}
