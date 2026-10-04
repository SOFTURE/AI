// Stripe's unit for an amount (https://docs.stripe.com/currencies, read 2026-10-04): the minor unit
// of a two-decimal currency unless Stripe lists the currency as zero- or three-decimal. Billing keeps
// every amount in `Intl`'s minor unit (`src/price.ts`); the two differ where CLDR drops a minor unit
// Stripe keeps (ISK and UGX, Stripe's "special cases", and e.g. ALL), so the adapter converts at its
// boundary: amounts sent to Checkout, and amounts the webhook reads back.
import type { PlanPrice } from "./contract.js";
import { getMinorUnitDigits } from "./price.js";

/**
 * Charged without a minor unit. UGX is not here: Stripe still takes it as a two-decimal value whose
 * decimals are always 00 (as ISK). The guide's text export omits the list; this is Stripe's
 * long-standing list, which the guide's index matches.
 */
export const STRIPE_ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "VND", "VUV", "XAF", "XOF", "XPF",
]);

/**
 * Charged with three decimals, and the last one must be 0 (Stripe's earlier guide; the current
 * text export omits the section).
 */
export const STRIPE_THREE_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

/** Digits of the unit Stripe takes for `currency` (ISO 4217, upper case): 0, 2 or 3. */
export function getStripeMinorUnitDigits(currency: string): number {
  if (STRIPE_ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
  if (STRIPE_THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
  return 2;
}

/** How many digits Stripe's unit has beyond billing's (negative when it has fewer). */
function getDigitShift(currency: string): number {
  return getStripeMinorUnitDigits(currency) - getMinorUnitDigits(currency);
}

/**
 * The price as Stripe's `unit_amount`, e.g. ISK 1,500 (`amount: 1500`) as 150000; null when Stripe
 * cannot charge it exactly (a fraction of Stripe's unit, or a three-decimal amount not ending in 0).
 */
export function toStripeAmount(price: PlanPrice): number | null {
  const shift = getDigitShift(price.currency);
  const amount = shift >= 0 ? price.amount * 10 ** shift : price.amount / 10 ** -shift;
  if (!Number.isInteger(amount)) return null;
  if (STRIPE_THREE_DECIMAL_CURRENCIES.has(price.currency) && amount % 10 !== 0) return null;
  return amount;
}

/**
 * An amount Stripe reports (a checkout's total, a charge's refunded total) in billing's unit,
 * rounded down when it is not whole, so a refunded total is never over-counted.
 */
export function fromStripeAmount(amount: number, currency: string): number {
  const shift = getDigitShift(currency);
  return shift >= 0 ? Math.floor(amount / 10 ** shift) : amount * 10 ** -shift;
}

/** Why Stripe cannot charge `price` exactly, for the config error; null when it can. */
export function describeStripePriceProblem(price: PlanPrice): string | null {
  if (toStripeAmount(price) !== null) return null;
  if (STRIPE_THREE_DECIMAL_CURRENCIES.has(price.currency)) {
    return `stripe() charges ${price.currency} in multiples of 10 of its minor unit; round the amount to end in 0`;
  }
  return `stripe() charges ${price.currency} with ${String(getStripeMinorUnitDigits(price.currency))} decimals; the amount must be a whole number of them`;
}
