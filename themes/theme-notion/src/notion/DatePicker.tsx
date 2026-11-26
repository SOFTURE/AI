"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";

import { cn } from "../lib/utils.js";
import { en } from "../messages/en.js";
import { Button } from "../ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

/** The copy of a date picker; every text replaces the English default from `notionMessages.en.datePicker`. */
export type DatePickerMessages = { readonly [Key in keyof typeof en.datePicker]: string };

/** The props both pickers share; the trigger button's own props (`id`, `aria-*`, `className`) pass through. */
interface PickerBaseProps extends Omit<ComponentProps<"button">, "value" | "defaultValue" | "onChange" | "type" | "children" | "name"> {
  /** The name of the hidden input that carries the value in a form; no input without it. */
  readonly name?: string;
  /** The BCP 47 locale the value, the month and the weekdays are shown in; `en-US` by default. */
  readonly locale?: string;
  /** The app's IANA time zone: shown as a muted suffix and used for "today". The value itself has no zone. */
  readonly timeZone?: string;
  /** The first day of the week, 0 Sunday to 6 Saturday; Monday (1) by default. */
  readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Whether the calendar is open, for a controlled picker. */
  readonly open?: boolean;
  /** Whether the calendar starts open, for an uncontrolled picker. */
  readonly defaultOpen?: boolean;
  /** Told when the calendar opens (`true`) or closes (`false`). */
  readonly onOpenChange?: (isOpen: boolean) => void;
  /** The texts to replace, from the app's message layer. */
  readonly messages?: Partial<DatePickerMessages>;
  /** Classes of the popover with the calendar. */
  readonly contentClassName?: string;
}

export interface DatePickerProps extends PickerBaseProps {
  /** The chosen day, `YYYY-MM-DD`, for a controlled picker; `null` for none. A value that is not a real day is none. */
  readonly value?: string | null;
  /** The day an uncontrolled picker starts with, `YYYY-MM-DD`. */
  readonly defaultValue?: string | null;
  /** Told the new day, `YYYY-MM-DD`. */
  readonly onValueChange?: (value: string | null) => void;
  /** The first day that can be chosen, `YYYY-MM-DD`. */
  readonly min?: string;
  /** The last day that can be chosen, `YYYY-MM-DD`. */
  readonly max?: string;
}

export interface DateTimePickerProps extends PickerBaseProps {
  /** The chosen local date-time, `YYYY-MM-DDTHH:mm` (core's `LocalDateTime`), for a controlled picker; `null` for none. */
  readonly value?: string | null;
  /** The date-time an uncontrolled picker starts with, `YYYY-MM-DDTHH:mm`. */
  readonly defaultValue?: string | null;
  /** Told the new local date-time, `YYYY-MM-DDTHH:mm`; the app converts it with `getLocalDateTimeInstant(value, timeZone)`. */
  readonly onValueChange?: (value: string | null) => void;
  /** The earliest date-time that can be chosen, `YYYY-MM-DDTHH:mm` (a bare `YYYY-MM-DD` means its start). */
  readonly min?: string;
  /** The latest date-time that can be chosen, `YYYY-MM-DDTHH:mm` (a bare `YYYY-MM-DD` means its end). */
  readonly max?: string;
  /** The minutes offered: every `minuteStep` minutes from :00; 1 by default (5 and 15 are common). */
  readonly minuteStep?: number;
  /** The time a first chosen day starts with, `HH:mm`; `09:00` by default. */
  readonly defaultTime?: string;
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_DAY = 24 * 60;
const DAYS_PER_WEEK = 7;
const WEEKS_SHOWN = 6;
const DEFAULT_LOCALE = "en-US";
const DEFAULT_TIME = "09:00";

/** The UTC midnight of a `YYYY-MM-DD` day, or `null` when it is not a real day. */
function getDayDate(day: string): Date | null {
  const match = DAY_PATTERN.exec(day);
  if (match === null) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const value = new Date(Date.UTC(year, month - 1, date));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === date ? value : null;
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, "YYYY-MM-DD".length);
}

function addDays(day: string, count: number): string {
  const date = getDayDate(day) ?? new Date(0);
  date.setUTCDate(date.getUTCDate() + count);
  return formatDay(date);
}

/** The same day `count` months later, kept inside the shorter month (Jan 31 + 1 month is Feb 28). */
function addMonths(day: string, count: number): string {
  const date = getDayDate(day) ?? new Date(0);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return formatDay(target);
}

function getMonthKey(day: string): string {
  return day.slice(0, "YYYY-MM".length);
}

function clampDay(day: string, minDay: string | null, maxDay: string | null): string {
  if (minDay !== null && day < minDay) return minDay;
  if (maxDay !== null && day > maxDay) return maxDay;
  return day;
}

/** The 6 weeks shown for a month, each day `YYYY-MM-DD` or `null` for a cell of another month. */
function getMonthWeeks(day: string, weekStartsOn: number): (string | null)[][] {
  const first = getDayDate(`${getMonthKey(day)}-01`) ?? new Date(0);
  const offset = (first.getUTCDay() - weekStartsOn + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const month = getMonthKey(day);
  return Array.from({ length: WEEKS_SHOWN }, (_, week) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => {
      const cell = addDays(formatDay(first), week * DAYS_PER_WEEK + weekday - offset);
      return getMonthKey(cell) === month ? cell : null;
    }),
  );
}

/** Today's `YYYY-MM-DD` in `timeZone` (the device's zone without one, or when the zone is unknown). */
function getToday(timeZone: string | undefined): string {
  const read = (zone: string | undefined) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  try {
    return read(timeZone);
  } catch {
    return read(undefined);
  }
}

function toMinutes(time: string): number {
  const match = TIME_PATTERN.exec(time);
  return match === null ? 0 : Number(match[1]) * 60 + Number(match[2]);
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** A value split into its day and time (minutes of the day), or `null` when it is not one in the picker's format. */
interface Moment {
  readonly day: string;
  readonly minutes: number | null;
}

function parseValue(value: string | null | undefined, withTime: boolean): Moment | null {
  if (typeof value !== "string") return null;
  if (!withTime) return getDayDate(value) === null ? null : { day: value, minutes: null };
  const match = DATE_TIME_PATTERN.exec(value);
  if (match === null || getDayDate(match[1] ?? "") === null || !TIME_PATTERN.test(match[2] ?? "")) return null;
  return { day: match[1] ?? "", minutes: toMinutes(match[2] ?? "") };
}

/** A `min` / `max` bound; a bare day means its first (`min`) or last (`max`) minute. */
function parseBound(bound: string | undefined, edge: "min" | "max"): Moment | null {
  if (bound === undefined) return null;
  if (getDayDate(bound) !== null) return { day: bound, minutes: edge === "min" ? 0 : MINUTES_PER_DAY - 1 };
  return parseValue(bound, true);
}

function formatValue(moment: Moment): string {
  return moment.minutes === null ? moment.day : `${moment.day}T${formatTime(moment.minutes)}`;
}

/** The range of minutes on `day` inside the bounds. */
function getDayRange(day: string, minBound: Moment | null, maxBound: Moment | null): { from: number; to: number } {
  return {
    from: minBound !== null && minBound.day === day ? (minBound.minutes ?? 0) : 0,
    to: maxBound !== null && maxBound.day === day ? (maxBound.minutes ?? MINUTES_PER_DAY - 1) : MINUTES_PER_DAY - 1,
  };
}

/** `minutes` moved into `day`'s range, a bound rounded to the step where the step allows it. */
function clampMinutes(minutes: number, range: { from: number; to: number }, step: number): number {
  if (minutes < range.from) {
    const rounded = Math.ceil(range.from / step) * step;
    return rounded <= range.to ? rounded : range.from;
  }
  if (minutes > range.to) {
    const rounded = Math.floor(range.to / step) * step;
    return rounded >= range.from ? rounded : range.to;
  }
  return minutes;
}

const TRIGGER_CLASSES =
  "inline-flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md border border-input bg-field px-2.5 py-1 text-left text-base transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 max-md:h-touch-target md:text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40";

const SELECT_CLASSES =
  "h-7 min-w-0 rounded-md border border-input bg-field px-1.5 text-base tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-50 max-md:h-touch-target md:text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring";

const DAY_CLASSES =
  "inline-flex size-8 items-center justify-center rounded-md text-sm tabular-nums outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 max-md:size-touch-target aria-[current=date]:font-semibold aria-[current=date]:text-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:hover:bg-primary";

interface PickerProps extends PickerBaseProps {
  readonly withTime: boolean;
  readonly value?: string | null;
  readonly defaultValue?: string | null;
  readonly onValueChange?: (value: string | null) => void;
  readonly min?: string;
  readonly max?: string;
  readonly minuteStep?: number;
  readonly defaultTime?: string;
}

function Picker({
  withTime,
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  minuteStep = 1,
  defaultTime = DEFAULT_TIME,
  name,
  locale = DEFAULT_LOCALE,
  timeZone,
  weekStartsOn = 1,
  open,
  defaultOpen = false,
  onOpenChange,
  messages,
  className,
  contentClassName,
  disabled,
  ...triggerProps
}: PickerProps) {
  const copy = { ...en.datePicker, ...messages };
  const captionId = useId();
  const timeLabelId = useId();
  const calendarRef = useRef<HTMLDivElement>(null);
  const shouldFocusDay = useRef(false);

  const isValueControlled = value !== undefined;
  const [innerValue, setInnerValue] = useState<string | null>(defaultValue ?? null);
  const moment = parseValue(isValueControlled ? value : innerValue, withTime);

  const isOpenControlled = open !== undefined;
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = isOpenControlled ? open : innerOpen;

  const minBound = parseBound(min, "min");
  const maxBound = parseBound(max, "max");
  const minDay = minBound?.day ?? null;
  const maxDay = maxBound?.day ?? null;
  const step = Number.isInteger(minuteStep) && minuteStep > 0 && minuteStep <= 60 ? minuteStep : 1;

  const [today, setToday] = useState<string | null>(null);
  const [focusedDay, setFocusedDay] = useState<string>(() => clampDay(moment?.day ?? getToday(timeZone), minDay, maxDay));

  const changeOpen = (next: boolean) => {
    if (next) {
      const now = getToday(timeZone);
      setToday(now);
      setFocusedDay(clampDay(moment?.day ?? now, minDay, maxDay));
    }
    if (!isOpenControlled) setInnerOpen(next);
    onOpenChange?.(next);
  };

  // A controlled picker opened from outside still needs today and the focused day.
  useEffect(() => {
    if (isOpen && today === null) {
      const now = getToday(timeZone);
      setToday(now);
      setFocusedDay(clampDay(moment?.day ?? now, minDay, maxDay));
    }
  }, [isOpen, today, timeZone, moment?.day, minDay, maxDay]);

  useEffect(() => {
    if (!shouldFocusDay.current) return;
    shouldFocusDay.current = false;
    calendarRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusedDay}"]`)?.focus();
  }, [focusedDay]);

  const commit = (next: Moment | null) => {
    const text = next === null ? null : formatValue(next);
    if (!isValueControlled) setInnerValue(text);
    onValueChange?.(text);
  };

  const chooseDay = (day: string) => {
    if (!withTime) {
      commit({ day, minutes: null });
      changeOpen(false);
      return;
    }
    const start = moment?.minutes ?? clampMinutes(toMinutes(TIME_PATTERN.test(defaultTime) ? defaultTime : DEFAULT_TIME), { from: 0, to: MINUTES_PER_DAY - 1 }, step);
    const rounded = moment === null ? Math.round(start / step) * step : start;
    commit({ day, minutes: clampMinutes(Math.min(rounded, MINUTES_PER_DAY - 1), getDayRange(day, minBound, maxBound), step) });
    setFocusedDay(day);
  };

  const moveFocus = (day: string) => {
    shouldFocusDay.current = true;
    setFocusedDay(clampDay(day, minDay, maxDay));
  };

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const weekday = ((getDayDate(focusedDay)?.getUTCDay() ?? 0) - weekStartsOn + DAYS_PER_WEEK) % DAYS_PER_WEEK;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focusedDay, -1),
      ArrowRight: () => addDays(focusedDay, 1),
      ArrowUp: () => addDays(focusedDay, -DAYS_PER_WEEK),
      ArrowDown: () => addDays(focusedDay, DAYS_PER_WEEK),
      PageUp: () => addMonths(focusedDay, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focusedDay, event.shiftKey ? 12 : 1),
      Home: () => addDays(focusedDay, -weekday),
      End: () => addDays(focusedDay, DAYS_PER_WEEK - 1 - weekday),
    };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    moveFocus(move());
  };

  const pageMonth = (count: number) => {
    setFocusedDay(clampDay(addMonths(focusedDay, count), minDay, maxDay));
  };

  const changeTime = (hours: number | null, minutes: number | null) => {
    if (moment === null) return;
    const current = moment.minutes ?? 0;
    const next = (hours ?? Math.floor(current / 60)) * 60 + (minutes ?? current % 60);
    commit({ day: moment.day, minutes: clampMinutes(next, getDayRange(moment.day, minBound, maxBound), step) });
  };

  const formatOptions: Intl.DateTimeFormatOptions = withTime
    ? { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }
    : { dateStyle: "medium", timeZone: "UTC" };
  const shownValue =
    moment === null
      ? null
      : new Intl.DateTimeFormat(locale, formatOptions).format(
          new Date((getDayDate(moment.day)?.getTime() ?? 0) + (moment.minutes ?? 0) * 60_000),
        );

  const monthCaption = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(getDayDate(focusedDay) ?? new Date(0));
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
  // 2023-01-01 was a Sunday: the weekday names from the week's first day on.
  const weekdays = Array.from({ length: DAYS_PER_WEEK }, (_, index) => new Date(Date.UTC(2023, 0, 1 + ((weekStartsOn + index) % DAYS_PER_WEEK))));
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  const weeks = getMonthWeeks(focusedDay, weekStartsOn);
  const monthKey = getMonthKey(focusedDay);

  const hourLabel = new Intl.DateTimeFormat(locale, { hour: "numeric", timeZone: "UTC" });
  const range = moment === null ? { from: 0, to: MINUTES_PER_DAY - 1 } : getDayRange(moment.day, minBound, maxBound);
  const currentHour = moment?.minutes === null || moment === null ? null : Math.floor(moment.minutes / 60);
  const currentMinute = moment?.minutes === null || moment === null ? null : moment.minutes % 60;
  const minuteOptions = Array.from({ length: Math.ceil(60 / step) }, (_, index) => index * step);
  if (currentMinute !== null && !minuteOptions.includes(currentMinute)) {
    minuteOptions.push(currentMinute);
    minuteOptions.sort((first, second) => first - second);
  }

  return (
    <Popover open={isOpen} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="date-picker-trigger"
          aria-haspopup="dialog"
          disabled={disabled}
          className={cn(TRIGGER_CLASSES, className)}
          {...triggerProps}
        >
          <CalendarDays strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span data-slot="date-picker-value" className={cn("min-w-0 flex-1 truncate", shownValue === null && "text-muted-foreground")}>
            {shownValue ?? (withTime ? copy.placeholderDateTime : copy.placeholder)}
          </span>
          {timeZone === undefined ? null : (
            <span data-slot="date-picker-time-zone" className="shrink-0 text-xs text-muted-foreground">
              {timeZone}
            </span>
          )}
        </button>
      </PopoverTrigger>
      {name === undefined ? null : <input type="hidden" name={name} value={moment === null ? "" : formatValue(moment)} />}
      <PopoverContent
        align="start"
        className={cn("w-auto p-3", contentClassName)}
        aria-label={copy.dialog}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          calendarRef.current?.querySelector<HTMLButtonElement>('[data-day][tabindex="0"]')?.focus();
        }}
      >
        <div ref={calendarRef} data-slot="date-picker-calendar" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.previousMonth}
              className="max-md:size-touch-target"
              disabled={minDay !== null && monthKey <= getMonthKey(minDay)}
              onClick={() => pageMonth(-1)}
            >
              <ChevronLeft strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            </Button>
            <div id={captionId} data-slot="date-picker-caption" aria-live="polite" className="text-sm font-medium">
              {monthCaption}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.nextMonth}
              className="max-md:size-touch-target"
              disabled={maxDay !== null && monthKey >= getMonthKey(maxDay)}
              onClick={() => pageMonth(1)}
            >
              <ChevronRight strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            </Button>
          </div>
          <table role="grid" aria-labelledby={captionId} data-slot="date-picker-grid" className="border-collapse">
            <thead>
              <tr>
                {weekdays.map((weekday) => (
                  <th key={weekday.getUTCDay()} scope="col" abbr={weekdayLong.format(weekday)} className="pb-1 text-xs font-normal text-muted-foreground">
                    {weekdayShort.format(weekday)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((day, dayIndex) =>
                    day === null ? (
                      <td key={dayIndex} />
                    ) : (
                      <td key={day} role="gridcell" aria-selected={moment?.day === day} className="p-0 text-center">
                        <button
                          type="button"
                          data-day={day}
                          data-selected={moment?.day === day}
                          tabIndex={day === focusedDay ? 0 : -1}
                          aria-label={fullDate.format(getDayDate(day) ?? new Date(0))}
                          aria-current={day === today ? "date" : undefined}
                          disabled={(minDay !== null && day < minDay) || (maxDay !== null && day > maxDay)}
                          className={DAY_CLASSES}
                          onClick={() => chooseDay(day)}
                          onFocus={() => setFocusedDay(day)}
                          onKeyDown={handleDayKeyDown}
                        >
                          {Number(day.slice(-2))}
                        </button>
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {withTime ? (
            <div data-slot="date-picker-time" role="group" aria-labelledby={timeLabelId} className="flex items-center gap-1.5 border-t border-border pt-2">
              <span id={timeLabelId} className="mr-auto text-sm text-muted-foreground">
                {copy.time}
              </span>
              <select
                aria-label={copy.hours}
                className={SELECT_CLASSES}
                disabled={moment === null}
                value={currentHour ?? ""}
                onChange={(event) => changeTime(Number(event.target.value), null)}
              >
                {currentHour === null ? <option value="" /> : null}
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour} disabled={hour * 60 + 59 < range.from || hour * 60 > range.to}>
                    {hourLabel.format(new Date(Date.UTC(2023, 0, 1, hour)))}
                  </option>
                ))}
              </select>
              <span aria-hidden="true">:</span>
              <select
                aria-label={copy.minutes}
                className={SELECT_CLASSES}
                disabled={moment === null}
                value={currentMinute ?? ""}
                onChange={(event) => changeTime(null, Number(event.target.value))}
              >
                {currentMinute === null ? <option value="" /> : null}
                {minuteOptions.map((minute) => {
                  const total = (currentHour ?? 0) * 60 + minute;
                  return (
                    <option key={minute} value={minute} disabled={total < range.from || total > range.to}>
                      {String(minute).padStart(2, "0")}
                    </option>
                  );
                })}
              </select>
              {timeZone === undefined ? null : <span className="text-xs text-muted-foreground">{timeZone}</span>}
            </div>
          ) : null}
          {withTime ? (
            <Button type="button" size="sm" className="self-end max-md:h-touch-target" onClick={() => changeOpen(false)}>
              {copy.done}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * A day field: a trigger with the `Input` look that shows the day in the app's locale, and a popover with a month
 * calendar driven by the keyboard (arrows by day and week, Page Up/Down by month, with Shift by year, Home/End to the
 * week's edges, Enter to choose, Escape to close). The value is `YYYY-MM-DD`; days outside `min` / `max` are disabled
 * and the keys stay inside them. With `name`, a hidden input carries the value in a form. Below `md` the trigger and the
 * days are the 44 px touch target.
 */
export function DatePicker(props: DatePickerProps) {
  return <Picker {...props} withTime={false} />;
}

/**
 * A date-and-time field: `DatePicker` with an hours and minutes field (minutes by `minuteStep`) under the calendar. The
 * value is a local date-time, `YYYY-MM-DDTHH:mm` (core's `LocalDateTime`), with no zone: `timeZone` is shown next to it
 * and the app converts it with `getLocalDateTimeInstant(value, timeZone)`. A new day keeps the chosen time (the first
 * one starts at `defaultTime`), moved into `min` / `max`; the times outside them are disabled.
 */
export function DateTimePicker({ minuteStep, defaultTime, ...props }: DateTimePickerProps) {
  return <Picker {...props} withTime minuteStep={minuteStep} defaultTime={defaultTime} />;
}
