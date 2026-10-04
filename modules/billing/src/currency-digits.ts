// The minor unit billing pins for each currency it accepts: a plan's `price.amount` counts these
// units on every runtime, whatever the runtime's `Intl` (CLDR) says. Source: ISO 4217 List One,
// published 2024-06-25, without fund codes, `N.A.` units (metals, XDR, XTS, XXX ...) and UYW (a wage
// index unit), plus the two choices below. CLDR differs from ISO on AFN, ALL, IRR, KPW, LAK, LBP,
// MMK, RSD, SOS, SYP and YER (0 instead of 2) and IQD (0 instead of 3), and its HUF and TWD digits
// have changed between Node builds; billing follows ISO, as Stripe does for all but MGA.

/** ISO 4217 codes by the digits of their minor unit. */
const CODES_BY_DIGITS: Readonly<Record<0 | 2 | 3, readonly string[]>> = {
  0: [
    "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
    // Override: ISO writes 2, but one ariary is five iraimbilanja (not a decimal subunit), and CLDR
    // and Stripe both count it without a minor unit.
    "MGA",
  ],
  2: [
    "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BGN", "BMD", "BND",
    "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CNY", "COP", "CRC", "CUC", "CUP", "CVE",
    "CZK", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GTQ",
    "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS", "INR", "IRR", "JMD", "KES", "KGS", "KHR", "KPW", "KYD", "KZT",
    "LAK", "LBP", "LKR", "LRD", "LSL", "MAD", "MDL", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN",
    "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "QAR", "RON",
    "RSD", "RUB", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SVC", "SYP",
    "SZL", "THB", "TJS", "TMT", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "USD", "UYU", "UZS", "VED", "VES", "WST",
    "XCD", "YER", "ZAR", "ZMW", "ZWG",
    // Addition: the Caribbean guilder, which replaced ANG on 2025-03-31, after the pinned list.
    "XCG",
  ],
  3: ["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"],
};

/** Digits of the minor unit per currency code billing accepts, e.g. `PLN: 2`, `JPY: 0`, `KWD: 3`. */
export const CURRENCY_MINOR_UNIT_DIGITS: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    Object.entries(CODES_BY_DIGITS).flatMap(([digits, codes]) => codes.map((code) => [code, Number(digits)] as const)),
  ),
);
