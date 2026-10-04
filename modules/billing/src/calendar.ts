// Calendar days in the app's IANA time zone, without a date library: trials end at the start of a
// local day and "days left" counts local days, as people do.

const DAY_MS = 24 * 60 * 60 * 1000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  let format = formatters.get(timezone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timezone, format);
  }
  return format;
}

/** The local wall-clock time of an instant, read as if it were UTC (milliseconds). */
function getLocalWallTime(instant: number, timezone: string): number {
  const parts = Object.fromEntries(
    getFormatter(timezone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}

/** The calendar day of an instant in a time zone, as a day count; two of them subtract to days. */
export function getDayNumber(instant: Date, timezone: string): number {
  return Math.floor(getLocalWallTime(instant.getTime(), timezone) / DAY_MS);
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * The instant a local day starts (00:00 there). Two passes settle the offset across a DST change.
 * In a zone that skips midnight itself (America/Santiago, America/Havana) 00:00 does not exist and
 * the passes land in the previous day, so the result moves on by hours to the first instant of
 * the day: 01:00 after a one-hour gap.
 */
export function getStartOfDay(dayNumber: number, timezone: string): Date {
  const wallTime = dayNumber * DAY_MS;
  let instant = wallTime;
  for (let pass = 0; pass < 2; pass += 1) instant = wallTime - (getLocalWallTime(instant, timezone) - instant);
  for (let step = 0; step < 3 && getDayNumber(new Date(instant), timezone) < dayNumber; step += 1) {
    instant = Math.floor(instant / HOUR_MS) * HOUR_MS + HOUR_MS;
  }
  return new Date(instant);
}

/**
 * The end of a trial of `days` days begun at `start`: the start of the local day `days` days after
 * the start day. The start day counts as the first day, so a 14-day trial begun on 3 October ends
 * when 17 October begins. Zero days ends it at the start of the start day: no trial.
 */
export function getTrialEnd(start: Date, days: number, timezone: string): Date {
  return getStartOfDay(getDayNumber(start, timezone) + days, timezone);
}

/**
 * Local calendar days of access left before `end`, today included: 1 on the last day. Assumes
 * `end` is after `now`.
 */
export function getDaysLeft(end: Date, now: Date, timezone: string): number {
  return getDayNumber(new Date(end.getTime() - 1), timezone) - getDayNumber(now, timezone) + 1;
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The day number (as `getDayNumber` counts) of a `YYYY-MM-DD` calendar day, or null when the text
 * is not one (`2026-1-1`, `2026-02-30`).
 */
export function parseDay(day: string): number | null {
  const match = DAY_PATTERN.exec(day);
  if (match === null) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const wallTime = Date.UTC(year, month - 1, date);
  const parsed = new Date(wallTime);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) return null;
  return wallTime / DAY_MS;
}
