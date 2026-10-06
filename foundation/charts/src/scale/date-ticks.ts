// Calendar date ticks: local midnights on day, month or year boundaries in the app's time zone.
// The step rule is the value ticks' (the count closest to the target, a tie to the larger step).
import { fromDayNumber, getCalendarDate, getZonedMidnight, toDayNumber, type CalendarDate } from "./time-zone.js";
import { YEAR_STEPS } from "./value-ticks.js";

export type DateTickUnit = "day" | "month" | "year";

export interface DateTicks {
  readonly unit: DateTickUnit;
  readonly step: number;
  /** Local midnights in `[start, end]`, ascending. */
  readonly ticks: readonly Date[];
}

interface DateTickOptions {
  readonly start: Date;
  readonly end: Date;
  /** Roughly how many ticks to show. */
  readonly target: number;
  /** IANA time zone of the app (core's `config.timezone`), e.g. "Europe/Warsaw". */
  readonly timeZone: string;
}

const MS_PER_DAY = 86_400_000;
/** 1970-01-05, the first Monday of the civil day count: weeks start on Monday (ISO 8601). */
const FIRST_MONDAY = 4;

interface Candidate {
  readonly unit: DateTickUnit;
  readonly step: number;
  /** Approximate length of one step, for the estimate and the tie break. */
  readonly spanMs: number;
}

const CANDIDATES: readonly Candidate[] = [
  ...[1, 2, 7, 14].map((step) => ({ unit: "day" as const, step, spanMs: step * MS_PER_DAY })),
  ...[1, 2, 3, 6].map((step) => ({ unit: "month" as const, step, spanMs: step * 30.44 * MS_PER_DAY })),
  ...YEAR_STEPS.map((step) => ({ unit: "year" as const, step, spanMs: step * 365.25 * MS_PER_DAY })),
];

/**
 * Date ticks for a time axis, or `null` when the span is empty, the target is below one or no
 * boundary falls inside the span.
 */
export function dateTicks({ start, end, target, timeZone }: DateTickOptions): DateTicks | null {
  const durationMs = end.getTime() - start.getTime();
  if (!(durationMs > 0) || target < 1) return null;
  // A candidate with far more ticks than wanted cannot win; skip it before building its ticks.
  const maxCount = 4 * target + 2;
  let best: (DateTicks & { distance: number; spanMs: number }) | null = null;
  for (const candidate of CANDIDATES) {
    if (durationMs / candidate.spanMs > maxCount) continue;
    const ticks = buildTicks(candidate, { start, end, timeZone });
    if (ticks.length === 0) continue;
    const distance = Math.abs(ticks.length - target);
    if (best === null || distance < best.distance || (distance === best.distance && candidate.spanMs > best.spanMs)) {
      best = { unit: candidate.unit, step: candidate.step, ticks, distance, spanMs: candidate.spanMs };
    }
  }
  return best && { unit: best.unit, step: best.step, ticks: best.ticks };
}

function buildTicks(candidate: Candidate, { start, end, timeZone }: Omit<DateTickOptions, "target">): Date[] {
  const first = getCalendarDate(start, timeZone);
  const ticks: Date[] = [];
  for (let index = getAlignedIndex(candidate, first); ; index += candidate.step) {
    const tick = getZonedMidnight(toCalendarDate(candidate.unit, index), timeZone);
    if (tick.getTime() > end.getTime()) return ticks;
    if (tick.getTime() >= start.getTime()) ticks.push(tick);
  }
}

/** The index (day number, month number or year) of the last aligned boundary on or before a date. */
function getAlignedIndex({ unit, step }: Candidate, date: CalendarDate): number {
  if (unit === "year") return Math.floor(date.year / step) * step;
  if (unit === "month") return Math.floor((date.year * 12 + date.month - 1) / step) * step;
  const dayNumber = toDayNumber(date);
  return dayNumber - mod(dayNumber - FIRST_MONDAY, step);
}

function toCalendarDate(unit: DateTickUnit, index: number): CalendarDate {
  if (unit === "year") return { year: index, month: 1, day: 1 };
  if (unit === "month") return { year: Math.floor(index / 12), month: mod(index, 12) + 1, day: 1 };
  return fromDayNumber(index);
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

const LABEL_FORMATS: Record<DateTickUnit, Intl.DateTimeFormatOptions> = {
  year: { year: "numeric" },
  month: { month: "short", year: "numeric" },
  day: { day: "numeric", month: "short" },
};

interface DateLabelOptions {
  /** The app's locale, e.g. "pl-PL". */
  readonly locale: string;
  /** The zone the ticks were built in. */
  readonly timeZone: string;
}

/** The label of a date tick in the app's locale and time zone, through `Intl.DateTimeFormat`. */
export function formatDateTick(date: Date, unit: DateTickUnit, { locale, timeZone }: DateLabelOptions): string {
  return new Intl.DateTimeFormat(locale, { ...LABEL_FORMATS[unit], timeZone }).format(date);
}
