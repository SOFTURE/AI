// Prices of plans as the app shows them: the amount in the currency's minor unit, formatted by the
// locale (`Intl`), so "PLN 29.00" in en and its Polish notation (a decimal comma, the currency sign after) come
// from one config.
import type { Locale } from "@softure-ai/core";
import type { PlanPrice } from "./contract.js";

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: Locale, currency: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let format = formatters.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters.set(key, format);
  }
  return format;
}

/** Whether `currency` is an ISO 4217 code this runtime can format. */
export function isSupportedCurrency(currency: string): boolean {
  return Intl.supportedValuesOf("currency").includes(currency);
}

/** Digits of the currency's minor unit: 2 for PLN and EUR, 0 for JPY. */
export function getMinorUnitDigits(currency: string): number {
  return getFormatter("en", currency).resolvedOptions().maximumFractionDigits ?? 2;
}

/** The price in the locale's notation, e.g. "PLN 29.00" in en. */
export function formatPrice(price: PlanPrice, locale: Locale): string {
  return getFormatter(locale, price.currency).format(price.amount / 10 ** getMinorUnitDigits(price.currency));
}
