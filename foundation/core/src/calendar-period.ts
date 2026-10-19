// A calendar period: two calendar days (`YYYY-MM-DD`) with both ends included, so one day is
// `{ from: d, to: d }`. Zero-padded days sort as text in calendar order, so comparisons work on the strings.
import { z } from "zod";
import { calendarDaysBetween, calendarDaySchema, isCalendarDay } from "./calendar-day.js";

/** Calendar days from `from` to `to`, both included; `to` never comes before `from`. */
export interface CalendarPeriod {
  readonly from: string;
  readonly to: string;
}

/** A `CalendarPeriod` in tool and form input: two calendar days, `to` refused (path `["to"]`) when it comes first. */
export const calendarPeriodSchema = z
  .object({ from: calendarDaySchema, to: calendarDaySchema })
  // A malformed end already has its own issue, and zod still runs the refinement then: skip it, so the
  // order is checked only between two real days.
  .refine((period) => !isCalendarDay(period.from) || !isCalendarDay(period.to) || period.from <= period.to, {
    message: "must not come before from",
    path: ["to"],
  });

/** Whether `day` lies in `period`, both ends included. Throws a `RangeError` for a malformed day or period. */
export function isDayInPeriod(day: string, period: CalendarPeriod): boolean {
  const operation = "isDayInPeriod";
  assertCalendarDay(operation, day);
  assertPeriod(operation, period);
  return period.from <= day && day <= period.to;
}

/** Whether `a` and `b` share at least one day; adjacent periods do not. Throws a `RangeError` for a malformed period. */
export function doPeriodsOverlap(a: CalendarPeriod, b: CalendarPeriod): boolean {
  const operation = "doPeriodsOverlap";
  assertPeriod(operation, a);
  assertPeriod(operation, b);
  return a.from <= b.to && b.from <= a.to;
}

/** The number of days in `period`, both ends included: 1 for a single day. Throws a `RangeError` for a malformed period. */
export function countPeriodDays(period: CalendarPeriod): number {
  assertPeriod("countPeriodDays", period);
  return calendarDaysBetween(period.from, period.to) + 1;
}

function assertPeriod(operation: string, period: CalendarPeriod): void {
  assertCalendarDay(operation, period.from);
  assertCalendarDay(operation, period.to);
  if (period.to < period.from) {
    throw new RangeError(`${operation}: the period ends ("${period.to}") before it starts ("${period.from}")`);
  }
}

function assertCalendarDay(operation: string, day: string): void {
  if (!isCalendarDay(day)) throw new RangeError(`${operation}: "${String(day)}" is not a YYYY-MM-DD calendar day`);
}
