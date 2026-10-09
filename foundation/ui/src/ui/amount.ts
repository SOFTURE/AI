import { err, formatMessage, type Locale, ok, type Result } from "@softure-ai/core";
import { getCopy, type CopyProps } from "./copy.js";

// Money typed into a field, in integer cents. The notation follows the locale:
// - `pl`: groups of three separated by spaces ("1 234,56"), decimal comma or dot;
// - `en`: groups separated by commas or spaces ("1,234.56"), decimal dot.
// The server action parses with the same function the field formats with.

export type AmountErrorCode = "ui.amount_invalid" | "ui.amount_out_of_range";

/**
 * Space, no-break space, narrow no-break space, thin space: what people, `Intl` and typeset text put between
 * groups.
 */
const SPACES = "[ \\u00a0\\u202f\\u2009]";

const AMOUNT_PATTERN: Readonly<Record<Locale, RegExp>> = {
  pl: new RegExp(`^-?(?:[1-9]\\d{0,2}(?:${SPACES}\\d{3})+|\\d+)(?:[.,]\\d{1,2})?$`),
  en: new RegExp(`^-?(?:[1-9]\\d{0,2}(?:,\\d{3})+|[1-9]\\d{0,2}(?:${SPACES}\\d{3})+|\\d+)(?:\\.\\d{1,2})?$`),
};

const GROUP_SEPARATOR: Readonly<Record<Locale, RegExp>> = {
  pl: new RegExp(SPACES, "g"),
  en: new RegExp(`${SPACES}|,`, "g"),
};

const INPUT_FORMAT: Readonly<Record<Locale, { group: string; decimal: string }>> = {
  pl: { group: " ", decimal: "," },
  en: { group: ",", decimal: "." },
};

/** An amount the user typed, as integer cents. Empty text is invalid; a caller with an optional field checks for it first. */
export function parseAmount(text: string, locale: Locale): Result<number, AmountErrorCode> {
  const trimmed = text.trim();
  if (!AMOUNT_PATTERN[locale].test(trimmed)) return err("ui.amount_invalid");
  const isNegative = trimmed.startsWith("-");
  const unsigned = (isNegative ? trimmed.slice(1) : trimmed).replace(GROUP_SEPARATOR[locale], "");
  const [whole = "", fraction = ""] = unsigned.split(/[.,]/);
  // Padding as text, not arithmetic: "5" is 50 cents, "56" is 56.
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return err("ui.amount_out_of_range");
  // No negative zero: "-0.00" is 0.
  return ok(isNegative && cents !== 0 ? -cents : cents);
}

/** Integer cents as the field shows them: grouped, always two decimals ("1 234,56", "1,234.56"). */
export function formatAmountInput(cents: number, locale: Locale): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`formatAmountInput expects a safe integer number of cents, received ${cents}`);
  }
  const { group, decimal } = INPUT_FORMAT[locale];
  const absolute = Math.abs(cents);
  // Integer arithmetic only (the remainder is removed before dividing), then grouped as text.
  const whole = String((absolute - (absolute % 100)) / 100);
  const groups: string[] = [];
  for (let end = whole.length; end > 0; end -= 3) groups.unshift(whole.slice(Math.max(0, end - 3), end));
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}${groups.join(group)}${decimal}${fraction}`;
}

/** Typed text in the field's format when it parses, unchanged otherwise (the server reports it). */
export function normalizeAmountInput(text: string, locale: Locale): string {
  const parsed = parseAmount(text, locale);
  return parsed.ok ? formatAmountInput(parsed.value, locale) : text;
}

/** The message for an amount error code, with an example in the locale's notation. */
export function getAmountErrorMessage(code: AmountErrorCode, copy: CopyProps<"errors"> = {}): string {
  const messages = getCopy("errors", copy);
  const key = code === "ui.amount_invalid" ? "amount_invalid" : "amount_out_of_range";
  return formatMessage(messages[key], { example: formatAmountInput(123456, copy.locale ?? "en") });
}
