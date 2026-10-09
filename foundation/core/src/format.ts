// Days, money and percentages as people read them, one way for every module and app. A calendar day
// is formatted at UTC midnight in UTC, so neither the server's nor the reader's zone moves it.
import { isCalendarDay } from "./calendar-day.js";
import { CURRENCY_MINOR_UNIT_DIGITS } from "./currency-digits.js";
import type { Locale } from "./i18n.js";

/** `long`: October 4, 2026 (pl names the month in the genitive); `medium`: Oct 4, 2026; `numeric`: 10/04/2026 (pl: 04.10.2026). */
export type CalendarDayStyle = "long" | "medium" | "numeric";

export interface FormatMoneyOptions {
  /** Whole units only, rounded half away from zero: PLN 1,235 for 1234.56. */
  readonly rounded?: boolean;
  /** A `+` before a positive amount (a `-` before a negative one is always there); zero has neither. */
  readonly signed?: boolean;
  /** The locale's short notation for large amounts: PLN 1.2M. */
  readonly compact?: boolean;
}

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
export function formatCalendarDay(day: string, locale: Locale, style: CalendarDayStyle = "long"): string {
  if (!isCalendarDay(day)) throw new RangeError(`formatCalendarDay: "${String(day)}" is not a YYYY-MM-DD calendar day`);
  const key = `${locale}:${style}`;
  let format = dayFormatters.get(key);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, { ...DAY_STYLE_OPTIONS[style], timeZone: "UTC" });
    dayFormatters.set(key, format);
  }
  return format.format(new Date(`${day}T00:00:00Z`));
}

/**
 * An amount in the currency's minor unit (2900 PLN = PLN 29.00) in `locale`'s notation, thousands always
 * grouped (pl writes 1 234,56 where its default would leave four digits together). The minor unit is the pinned ISO
 * 4217 one (`CURRENCY_MINOR_UNIT_DIGITS`); a code outside the table gets `Intl`'s digits. Throws a
 * `RangeError` for an amount that is not a whole number of minor units, or a code `Intl` refuses.
 */
export function formatMoney(minor: number, currency: string, locale: Locale, options: FormatMoneyOptions = {}): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`formatMoney: ${String(minor)} is not a whole number of minor units`);
  const pinned = Object.hasOwn(CURRENCY_MINOR_UNIT_DIGITS, currency) ? CURRENCY_MINOR_UNIT_DIGITS[currency] : undefined;
  const digits = pinned ?? getNumberFormatter(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const shownDigits = options.rounded === true ? 0 : digits;
  const format = getNumberFormatter(locale, {
    style: "currency",
    currency,
    useGrouping: "always",
    signDisplay: options.signed === true ? "exceptZero" : "auto",
    ...(options.compact === true ? { notation: "compact" } : { minimumFractionDigits: shownDigits, maximumFractionDigits: shownDigits }),
  });
  return format.format(minor / 10 ** digits);
}

/** Basis points as a percentage in `locale`: 1250 is 12.5%, at most two fraction digits. Throws a `RangeError` for a non-finite value. */
export function formatPercent(basisPoints: number, locale: Locale): string {
  if (!Number.isFinite(basisPoints)) throw new RangeError(`formatPercent: ${String(basisPoints)} is not a finite number of basis points`);
  const format = getNumberFormatter(locale, { style: "percent", maximumFractionDigits: MAX_PERCENT_FRACTION_DIGITS });
  return format.format(basisPoints / BASIS_POINTS_PER_UNIT);
}

function getNumberFormatter(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let format = numberFormatters.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, format);
  }
  return format;
}
