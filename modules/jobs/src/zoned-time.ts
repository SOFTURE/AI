// Wall-clock time in an IANA time zone, with the platform's Intl data and no date library.

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
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall clock of `instant` in `timeZone`, to the minute. */
export function getWallClock(instant: number, timeZone: string): WallClock {
  const parts = Object.fromEntries(getFormatter(timeZone).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/**
 * The instant a clock in `timeZone` shows `wallClock`. A time that occurs twice (the hour a DST change repeats) gives
 * its first occurrence; a time that does not occur (the hour a DST change skips) gives the instant the same distance
 * after the change, so 02:30 on a day that jumps from 02:00 to 03:00 gives 03:30.
 */
export function getZonedInstant(wallClock: WallClock, timeZone: string): number {
  const asUtc = toUtcMs(wallClock);
  // One DST change a day at most: the offsets half a day before and after cover both sides of it.
  const offsetBefore = getOffsetMs(asUtc - 12 * HOUR_MS, timeZone);
  const offsetAfter = getOffsetMs(asUtc + 12 * HOUR_MS, timeZone);
  const matching = [asUtc - offsetBefore, asUtc - offsetAfter].filter((instant) => toUtcMs(getWallClock(instant, timeZone)) === asUtc);
  return matching.length > 0 ? Math.min(...matching) : asUtc - offsetBefore;
}

function getOffsetMs(instant: number, timeZone: string): number {
  const minute = Math.floor(instant / 60_000) * 60_000;
  return toUtcMs(getWallClock(minute, timeZone)) - minute;
}

function toUtcMs(wallClock: WallClock): number {
  return Date.UTC(wallClock.year, wallClock.month - 1, wallClock.day, wallClock.hour, wallClock.minute);
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}
