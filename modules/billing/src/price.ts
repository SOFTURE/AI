// Prices of plans as the app shows them: the amount counts the currency's minor unit as billing
// pins it (`src/currency-digits.ts`, ISO 4217), and the locale's `Intl` only supplies the notation,
// so "PLN 29.00" in en and its Polish notation (a decimal comma, the currency sign after) come from
// one config, and no runtime's CLDR can change the amount.
import type { Locale } from "@softure-ai/core";
import type { PlanPrice } from "./contract.js";
import { CURRENCY_MINOR_UNIT_DIGITS } from "./currency-digits.js";

const formatters = new Map<string, Intl.NumberFormat>();

/** The pinned digits, or undefined for a code billing does not accept. */
function findMinorUnitDigits(currency: string): number | undefined {
  return Object.hasOwn(CURRENCY_MINOR_UNIT_DIGITS, currency) ? CURRENCY_MINOR_UNIT_DIGITS[currency] : undefined;
}

function getFormatter(locale: Locale, currency: string, digits: number | undefined): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let format = formatters.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(
      locale,
      digits === undefined ? { style: "currency", currency } : { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits },
    );
    formatters.set(key, format);
  }
  return format;
}

/** Whether billing accepts `currency`: an upper-case ISO 4217 code in its pinned table. */
export function isSupportedCurrency(currency: string): boolean {
  return findMinorUnitDigits(currency) !== undefined;
}

/** Digits of the currency's minor unit: 2 for PLN, EUR and HUF, 0 for JPY, 3 for KWD. */
export function getMinorUnitDigits(currency: string): number {
  const digits = findMinorUnitDigits(currency);
  // A config with this code is refused when it loads, so reaching here is a bug.
  if (digits === undefined) throw new Error(`getMinorUnitDigits: billing does not know the currency "${currency}"`);
  return digits;
}

/**
 * The price in the locale's notation, e.g. "PLN 29.00" in en. A stored price in a code billing no
 * longer accepts is shown with `Intl`'s own digits, so a history page never breaks on it.
 */
export function formatPrice(price: PlanPrice, locale: Locale): string {
  const digits = findMinorUnitDigits(price.currency);
  const format = getFormatter(locale, price.currency, digits);
  return format.format(price.amount / 10 ** (digits ?? format.resolvedOptions().maximumFractionDigits ?? 2));
}
