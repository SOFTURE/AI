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

// Arithmetic on calendar days (`YYYY-MM-DD`): civil days with no time zone, so a day is a day even
// when DST makes it 23 or 25 hours long. A day number counts days since 1970-01-01.

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_PER_YEAR = 12;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CivilDate {
  readonly year: number;
  /** 0-based, as `Date` counts months. */
  readonly month: number;
  readonly day: number;
}

/** What `addCalendarMonths` does with a day the target month lacks (31 January + 1 month). */
export type EndOfMonth = "clamp" | "overflow";

/** Whether `value` is a real calendar day written `YYYY-MM-DD` (`2026-02-29` and `2026-1-1` are not). */
export function isCalendarDay(value: unknown): value is string {
  return typeof value === "string" && parseCivilDate(value) !== null;
}

/** `day` moved by `days` calendar days (negative goes back). Throws a `RangeError` for a malformed day or count. */
export function addCalendarDays(day: string, days: number): string {
  const operation = "addCalendarDays";
  assertWhole(operation, days, "days");
  return fromDayNumber(operation, toDayNumber(operation, day) + days);
}

/**
 * `day` moved by `months` calendar months (negative goes back). A day the target month lacks is the
 * month's last day with `endOfMonth: "clamp"` (the default: 31 January + 1 month = 28 or 29 February,
 * as billing periods count), or runs on into the next month with `"overflow"` (3 March in 2026, as
 * `Date` does). Throws a `RangeError` for a malformed day or count.
 */
export function addCalendarMonths(day: string, months: number, options: { readonly endOfMonth?: EndOfMonth } = {}): string {
  const operation = "addCalendarMonths";
  assertWhole(operation, months, "months");
  const date = readCivilDate(operation, day);
  const month = date.month + months;
  const lastDay = new Date(utcMilliseconds({ year: date.year, month: month + 1, day: 0 })).getUTCDate();
  const target = options.endOfMonth === "overflow" ? date.day : Math.min(date.day, lastDay);
  return fromDayNumber(operation, utcMilliseconds({ year: date.year, month, day: target }) / DAY_MS);
}

/** Calendar days from `from` to `to`: 1 from one day to the next, negative when `to` comes first. */
export function calendarDaysBetween(from: string, to: string): number {
  const operation = "calendarDaysBetween";
  return toDayNumber(operation, to) - toDayNumber(operation, from);
}

/**
 * Whole months from `from` to `to`: the most months `n` for which `addCalendarMonths(from, n)` (clamped)
 * is not after `to`. So 31 January to 28 February is one month, as a monthly period counts it.
 * Negative when `to` comes first: `wholeMonthsBetween(to, from)` with the sign turned.
 */
export function wholeMonthsBetween(from: string, to: string): number {
  const operation = "wholeMonthsBetween";
  const start = readCivilDate(operation, from);
  const end = readCivilDate(operation, to);
  if (to < from) return -wholeMonthsBetween(to, from);
  const months = (end.year - start.year) * MONTHS_PER_YEAR + (end.month - start.month);
  return addCalendarMonths(from, months) > to ? months - 1 : months;
}

function assertWhole(operation: string, count: number, unit: string): void {
  if (!Number.isSafeInteger(count)) throw new RangeError(`${operation}: ${String(count)} is not a whole number of ${unit}`);
}

/** Milliseconds of UTC midnight of a civil date; month and day may overflow, as in `Date.UTC`, for any year. */
function utcMilliseconds({ year, month, day }: CivilDate): number {
  // Not `Date.UTC`: it reads years 0-99 as 1900-1999.
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date.getTime();
}

function parseCivilDate(text: string): CivilDate | null {
  const match = DAY_PATTERN.exec(text);
  if (match === null) return null;
  const date = { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
  const parsed = new Date(utcMilliseconds(date));
  if (parsed.getUTCMonth() !== date.month || parsed.getUTCDate() !== date.day) return null;
  return date;
}

function readCivilDate(operation: string, day: string): CivilDate {
  const date = parseCivilDate(day);
  if (date === null) throw new RangeError(`${operation}: "${day}" is not a YYYY-MM-DD calendar day`);
  return date;
}

function toDayNumber(operation: string, day: string): number {
  return utcMilliseconds(readCivilDate(operation, day)) / DAY_MS;
}

function fromDayNumber(operation: string, dayNumber: number): string {
  const date = new Date(dayNumber * DAY_MS);
  const year = date.getUTCFullYear();
  if (year < 0 || year > 9999) throw new RangeError(`${operation}: the result falls outside the years 0000-9999`);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${String(year).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
