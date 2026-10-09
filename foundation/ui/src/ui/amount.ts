import { err, formatMessage, type Locale, ok, type Result } from "@softure-ai/core";
import { getCopy, type CopyProps } from "./copy.js";

// Money typed into a field, in integer cents. The notation follows the locale:
// - `pl`: groups of three separated by spaces ("1 234,56"), decimal comma or dot;
// - `en`: groups separated by commas or spaces ("1,234.56"), decimal dot.
// The server action parses with the same function the field formats with.

export type AmountErrorCode = "ui.amount_invalid" | "ui.amount_out_of_range";

/** Why typed text is not a fixed-point number: not in the locale's notation, or past the safe integer range. */
export type DecimalErrorCode = "ui.decimal_invalid" | "ui.decimal_out_of_range";

/** How many decimal places one integer unit stands for: 2 for cents or basis points of a percent, 6 for millionths. */
export interface DecimalScale {
  readonly scale: number;
}

export interface DecimalFormatOptions extends DecimalScale {
  /** Trailing zeros are trimmed down to this many fraction digits; `scale` (none trimmed) by default. */
  readonly minFractionDigits?: number;
}

/** At scale 16 even 1 is 10^16 units, past 2^53: no value would parse. */
const MAX_SCALE = 15;

/**
 * Space, no-break space, narrow no-break space, thin space: what people, `Intl` and typeset text put between
 * groups.
 */
const SPACES = "[ \\u00a0\\u202f\\u2009]";

const GROUPED_WHOLE: Readonly<Record<Locale, string>> = {
  pl: `[1-9]\\d{0,2}(?:${SPACES}\\d{3})+|\\d+`,
  en: `[1-9]\\d{0,2}(?:,\\d{3})+|[1-9]\\d{0,2}(?:${SPACES}\\d{3})+|\\d+`,
};

const DECIMAL_MARK: Readonly<Record<Locale, string>> = { pl: "[.,]", en: "\\." };

const GROUP_SEPARATOR: Readonly<Record<Locale, RegExp>> = {
  pl: new RegExp(SPACES, "g"),
  en: new RegExp(`${SPACES}|,`, "g"),
};

const INPUT_FORMAT: Readonly<Record<Locale, { group: string; decimal: string }>> = {
  pl: { group: " ", decimal: "," },
  en: { group: ",", decimal: "." },
};

const patternCache = new Map<string, RegExp>();

/** The whole-text pattern for a locale and scale: a scale of 0 takes no fraction, a scale of n up to n digits. */
function getDecimalPattern(locale: Locale, scale: number): RegExp {
  const cacheKey = `${locale}:${scale}`;
  const cached = patternCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const fraction = scale === 0 ? "" : `(?:${DECIMAL_MARK[locale]}\\d{1,${scale}})?`;
  const pattern = new RegExp(`^-?(?:${GROUPED_WHOLE[locale]})${fraction}$`);
  patternCache.set(cacheKey, pattern);
  return pattern;
}

function assertScale(operation: string, scale: number): void {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_SCALE) {
    throw new RangeError(`${operation} expects an integer scale from 0 to ${MAX_SCALE}, received ${scale}`);
  }
}

/**
 * A number the user typed, as an integer count of 10^-scale units: `scale: 2` reads "12,5" as 1250 (cents, basis
 * points of a percent), `scale: 6` reads "0,000123" as 123. The digit grammar is `parseAmount`'s. Empty text is
 * invalid; a caller with an optional field checks for it first.
 */
export function parseDecimal(text: string, locale: Locale, { scale }: DecimalScale): Result<number, DecimalErrorCode> {
  assertScale("parseDecimal", scale);
  const trimmed = text.trim();
  if (!getDecimalPattern(locale, scale).test(trimmed)) return err("ui.decimal_invalid");
  const isNegative = trimmed.startsWith("-");
  const unsigned = (isNegative ? trimmed.slice(1) : trimmed).replace(GROUP_SEPARATOR[locale], "");
  const [whole = "", fraction = ""] = unsigned.split(/[.,]/);
  // Joined as digits, not arithmetic: exact up to 2^53 - 1, and anything larger reads as at least 2^53.
  const units = Number(whole + fraction.padEnd(scale, "0"));
  if (!Number.isSafeInteger(units)) return err("ui.decimal_out_of_range");
  // No negative zero: "-0,00" is 0.
  return ok(isNegative && units !== 0 ? -units : units);
}

/**
 * An integer count of 10^-scale units as the field shows it: grouped, with `scale` fraction digits ("12,50" for
 * 1250 at scale 2 in `pl`), trailing zeros trimmed down to `minFractionDigits`.
 */
export function formatDecimal(units: number, locale: Locale, { scale, minFractionDigits = scale }: DecimalFormatOptions): string {
  assertScale("formatDecimal", scale);
  if (!Number.isSafeInteger(units)) {
    throw new RangeError(`formatDecimal expects a safe integer number of units, received ${units}`);
  }
  if (!Number.isInteger(minFractionDigits) || minFractionDigits < 0 || minFractionDigits > scale) {
    throw new RangeError(`formatDecimal expects minFractionDigits from 0 to the scale ${scale}, received ${minFractionDigits}`);
  }
  const { group, decimal } = INPUT_FORMAT[locale];
  // Text arithmetic only: split the digits at the scale, then group the whole part.
  const digits = String(Math.abs(units)).padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const groups: string[] = [];
  for (let end = whole.length; end > 0; end -= 3) groups.unshift(whole.slice(Math.max(0, end - 3), end));
  let fraction = digits.slice(digits.length - scale);
  while (fraction.length > minFractionDigits && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
  const sign = units < 0 ? "-" : "";
  return fraction === "" ? `${sign}${groups.join(group)}` : `${sign}${groups.join(group)}${decimal}${fraction}`;
}

/** Typed text in the field's format when it parses at `scale`, unchanged otherwise (the server reports it). */
export function normalizeDecimalInput(text: string, locale: Locale, options: DecimalFormatOptions): string {
  const parsed = parseDecimal(text, locale, options);
  return parsed.ok ? formatDecimal(parsed.value, locale, options) : text;
}

const AMOUNT_SCALE = { scale: 2 } as const;

const AMOUNT_ERROR: Readonly<Record<DecimalErrorCode, AmountErrorCode>> = {
  "ui.decimal_invalid": "ui.amount_invalid",
  "ui.decimal_out_of_range": "ui.amount_out_of_range",
};

/** An amount the user typed, as integer cents: `parseDecimal` at scale 2 with the amount error codes. */
export function parseAmount(text: string, locale: Locale): Result<number, AmountErrorCode> {
  const parsed = parseDecimal(text, locale, AMOUNT_SCALE);
  return parsed.ok ? parsed : err(AMOUNT_ERROR[parsed.error]);
}

/** Integer cents as the field shows them: grouped, always two decimals ("1 234,56", "1,234.56"). */
export function formatAmountInput(cents: number, locale: Locale): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`formatAmountInput expects a safe integer number of cents, received ${cents}`);
  }
  return formatDecimal(cents, locale, AMOUNT_SCALE);
}

/** Typed text in the field's format when it parses, unchanged otherwise (the server reports it). */
export function normalizeAmountInput(text: string, locale: Locale): string {
  return normalizeDecimalInput(text, locale, AMOUNT_SCALE);
}

/** The message for an amount error code, with an example in the locale's notation. */
export function getAmountErrorMessage(code: AmountErrorCode, copy: CopyProps<"errors"> = {}): string {
  const messages = getCopy("errors", copy);
  const key = code === "ui.amount_invalid" ? "amount_invalid" : "amount_out_of_range";
  return formatMessage(messages[key], { example: formatAmountInput(123456, copy.locale ?? "en") });
}
