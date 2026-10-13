// Days, money and percentages as people read them, one way for every module and app. A calendar day
// is formatted at UTC midnight in UTC, so neither the server's nor the reader's zone moves it. Every
// formatter takes any BCP 47 locale tag (an invalid one throws Intl's RangeError); the only built-in
// copy is English, and an app passes its own words where a formatter writes any.
import { isCalendarDay } from "./calendar-day.js";
import { CURRENCY_MINOR_UNIT_DIGITS } from "./currency-digits.js";
import { formatMessage, selectPlural, type PluralForms } from "./i18n.js";

/** `long`: October 4, 2026; `medium`: Oct 4, 2026; `numeric`: 10/04/2026 (each locale writes its own order and separators). */
export type CalendarDayStyle = "long" | "medium" | "numeric";

export interface FormatMoneyOptions {
  /** Whole units only, rounded half away from zero: PLN 1,235 for 1234.56. */
  readonly rounded?: boolean;
  /** A `+` before a positive amount (a `-` before a negative one is always there). Zero has neither in any mode, also a negative zero or an amount that rounds to zero. */
  readonly signed?: boolean;
  /** The locale's short notation for large amounts: PLN 1.2M. */
  readonly compact?: boolean;
}

/** `long`: October 2026; `roman`: X 2026. */
export type CalendarMonthStyle = "long" | "roman";

/** The words `formatDuration` writes: plural forms with `{count}`, and `both` joining `{years}` and `{months}`. */
export interface DurationMessages {
  readonly years: PluralForms;
  readonly months: PluralForms;
  readonly both: string;
}

export interface FormatDurationOptions {
  /** The BCP 47 tag whose plural rules pick a form (default `"en"`). */
  readonly locale?: string;
  /** The app's own words (default `DEFAULT_DURATION_MESSAGES`, English). */
  readonly messages?: DurationMessages;
}

export interface FormatPercentOptions {
  /** A `+` before a positive value (a `-` before a negative one is always there). Zero has neither in any mode. */
  readonly signed?: boolean;
  /** No space between the number and `%`, whatever the locale's pattern: `12,5%`, not `12,5 %`. */
  readonly tight?: boolean;
}

const MONTHS_PER_YEAR = 12;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const;
/** The built-in, English words of `formatDuration`; any other category falls back to `other`. */
export const DEFAULT_DURATION_MESSAGES: DurationMessages = {
  years: { one: "{count} year", other: "{count} years" },
  months: { one: "{count} month", other: "{count} months" },
  both: "{years} and {months}",
};
const BASIS_POINTS_PER_UNIT = 10_000;
const MAX_PERCENT_FRACTION_DIGITS = 2;

const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();

const DAY_STYLE_OPTIONS: Readonly<Record<CalendarDayStyle, Intl.DateTimeFormatOptions>> = {
  long: { dateStyle: "long" },
  medium: { dateStyle: "medium" },
  numeric: { day: "2-digit", month: "2-digit", year: "numeric" },
};

/** A `YYYY-MM-DD` day as `locale` writes it. Throws a `RangeError` for a malformed day. */
export function formatCalendarDay(day: string, locale: string, style: CalendarDayStyle = "long"): string {
  if (!isCalendarDay(day)) throw new RangeError(`formatCalendarDay: "${String(day)}" is not a YYYY-MM-DD calendar day`);
  return getDayFormatter(`${locale}:${style}`, locale, DAY_STYLE_OPTIONS[style]).format(new Date(`${day}T00:00:00Z`));
}

/** Whether `value` is a real calendar month written `YYYY-MM` (`2026-13` and `2026-1` are not). */
export function isCalendarMonth(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = MONTH_PATTERN.exec(value);
  if (match === null) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= MONTHS_PER_YEAR;
}

/**
 * The month of a `YYYY-MM` month or a `YYYY-MM-DD` day, with its year, as `locale` writes it alone. Throws a
 * `RangeError` for anything else.
 */
export function formatCalendarMonth(month: string, locale: string, style: CalendarMonthStyle = "long"): string {
  const firstDay = isCalendarMonth(month) ? `${month}-01` : month;
  if (!isCalendarDay(firstDay)) throw new RangeError(`formatCalendarMonth: "${String(month)}" is not a YYYY-MM month or a YYYY-MM-DD day`);
  const date = new Date(`${firstDay}T00:00:00Z`);
  const year = firstDay.slice(0, 4);
  if (style === "roman") return `${ROMAN_MONTHS[date.getUTCMonth()] ?? ""} ${year}`;
  return getDayFormatter(`${locale}:month`, locale, { month: "long", year: "numeric" }).format(date);
}

/**
 * Whole months as years and months: 38 is "3 years and 2 months"; a part that is zero is left out, and zero itself is
 * "0 months". English by default; an app passes its own `messages` and the `locale` whose plural rules pick among
 * them. Throws a `RangeError` for a negative or fractional count, or an invalid locale tag.
 */
export function formatDuration(months: number, options: FormatDurationOptions = {}): string {
  if (!Number.isSafeInteger(months) || months < 0) {
    throw new RangeError(`formatDuration: ${String(months)} is not a whole, non-negative number of months`);
  }
  const locale = options.locale ?? "en";
  const copy = options.messages ?? DEFAULT_DURATION_MESSAGES;
  const years = Math.floor(months / MONTHS_PER_YEAR);
  const rest = months % MONTHS_PER_YEAR;
  const yearsText = formatMessage(selectPlural(locale, years, copy.years), { count: years });
  const monthsText = formatMessage(selectPlural(locale, rest, copy.months), { count: rest });
  if (years === 0) return monthsText;
  if (rest === 0) return yearsText;
  return formatMessage(copy.both, { years: yearsText, months: monthsText });
}

/**
 * An amount in the currency's minor unit (2900 PLN = PLN 29.00) in `locale`'s notation, thousands always
 * grouped (even where a locale's default would leave four digits together), and zero is never signed (`-0`
 * and an amount that rounds to zero show as zero). The minor unit is the pinned ISO
 * 4217 one (`CURRENCY_MINOR_UNIT_DIGITS`); a code outside the table gets `Intl`'s digits. Throws a
 * `RangeError` for an amount that is not a whole number of minor units, or a code `Intl` refuses.
 */
export function formatMoney(minor: number, currency: string, locale: string, options: FormatMoneyOptions = {}): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`formatMoney: ${String(minor)} is not a whole number of minor units`);
  const pinned = Object.hasOwn(CURRENCY_MINOR_UNIT_DIGITS, currency) ? CURRENCY_MINOR_UNIT_DIGITS[currency] : undefined;
  const digits = pinned ?? getNumberFormatter(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const shownDigits = options.rounded === true ? 0 : digits;
  const format = getNumberFormatter(locale, {
    style: "currency",
    currency,
    useGrouping: "always",
    signDisplay: options.signed === true ? "exceptZero" : "negative",
    ...(options.compact === true ? { notation: "compact" } : { minimumFractionDigits: shownDigits, maximumFractionDigits: shownDigits }),
  });
  return format.format(minor / 10 ** digits);
}

/**
 * Basis points as a percentage in `locale`: 1250 is 12.5%, at most two fraction digits, and zero is never signed (`-0`
 * and a value that rounds to zero show as `0%`). Throws a `RangeError` for a non-finite value.
 */
export function formatPercent(basisPoints: number, locale: string, options: FormatPercentOptions = {}): string {
  if (!Number.isFinite(basisPoints)) throw new RangeError(`formatPercent: ${String(basisPoints)} is not a finite number of basis points`);
  const format = getNumberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: MAX_PERCENT_FRACTION_DIGITS,
    signDisplay: options.signed === true ? "exceptZero" : "negative",
  });
  const value = basisPoints / BASIS_POINTS_PER_UNIT;
  if (options.tight !== true) return format.format(value);
  const parts = format.formatToParts(value);
  return parts
    .filter((part, index) => !(part.type === "literal" && part.value.trim() === "" && isNextToPercentSign(parts, index)))
    .map((part) => part.value)
    .join("");
}

function isNextToPercentSign(parts: readonly Intl.NumberFormatPart[], index: number): boolean {
  return parts[index - 1]?.type === "percentSign" || parts[index + 1]?.type === "percentSign";
}

function getDayFormatter(key: string, locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let format = dayFormatters.get(key);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
    dayFormatters.set(key, format);
  }
  return format;
}

function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let format = numberFormatters.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, format);
  }
  return format;
}
