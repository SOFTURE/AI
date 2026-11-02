// The current day or month in the app's time zone, as the instants a budget period starts and resets at.
import { addCalendarDays, addCalendarMonths, getDayStartInstant, toCalendarDay } from "@softure-ai/core";
import type { BudgetPeriod } from "../contract.js";

export interface PeriodBounds {
  /** The period's first instant, included. */
  readonly from: Date;
  /** The next period's first instant, excluded. */
  readonly resetsAt: Date;
}

/** The bounds of the `period` that contains `instant`, with days starting at midnight in `timeZone`. */
export function getPeriodBounds(period: BudgetPeriod, instant: Date, timeZone: string): PeriodBounds {
  const day = toCalendarDay(instant, timeZone);
  const first = period === "day" ? day : `${day.slice(0, 7)}-01`;
  const next = period === "day" ? addCalendarDays(first, 1) : addCalendarMonths(first, 1);
  return { from: getDayStartInstant(first, timeZone), resetsAt: getDayStartInstant(next, timeZone) };
}
