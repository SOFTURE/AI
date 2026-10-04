// Prices in the currency's minor unit as billing pins it (ISO 4217), formatted by the locale.
import { CURRENCY_MINOR_UNIT_DIGITS, formatPrice, getMinorUnitDigits, isSupportedCurrency } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

/** `Intl` puts no-break spaces between the parts; the tests compare plain spaces. */
function plain(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, " ");
}

describe("prices", () => {
  it("formats an amount in the locale's notation", () => {
    expect(plain(formatPrice({ amount: 2900, currency: "PLN" }, "en"))).toBe("PLN 29.00");
    expect(plain(formatPrice({ amount: 2900, currency: "PLN" }, "pl"))).toBe("29,00 z\u0142");
    expect(plain(formatPrice({ amount: 123456, currency: "EUR" }, "pl"))).toBe("1234,56 €");
    expect(plain(formatPrice({ amount: 999, currency: "USD" }, "en"))).toBe("$9.99");
    expect(plain(formatPrice({ amount: 0, currency: "PLN" }, "en"))).toBe("PLN 0.00");
  });

  it("knows currencies without a minor unit", () => {
    expect(getMinorUnitDigits("PLN")).toBe(2);
    expect(getMinorUnitDigits("JPY")).toBe(0);
    expect(plain(formatPrice({ amount: 1500, currency: "JPY" }, "en"))).toBe("¥1,500");
  });

  it("formats a three-decimal currency with its three digits", () => {
    expect(getMinorUnitDigits("KWD")).toBe(3);
    expect(plain(formatPrice({ amount: 1250, currency: "KWD" }, "en"))).toBe("KWD 1.250");
    expect(plain(formatPrice({ amount: 1250, currency: "KWD" }, "pl"))).toBe("1,250 KWD");
  });

  it("tells a known currency code from a made-up one", () => {
    expect(isSupportedCurrency("PLN")).toBe(true);
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(isSupportedCurrency("pln")).toBe(false);
    expect(isSupportedCurrency("toString")).toBe(false);
  });

  it("accepts the pinned ISO 4217 codes, not what the runtime happens to list", () => {
    // Withdrawn by ISO, still listed by some runtimes.
    expect(isSupportedCurrency("HRK")).toBe(false);
    expect(isSupportedCurrency("SLL")).toBe(false);
    // Funds and units that are not prices.
    expect(isSupportedCurrency("CLF")).toBe(false);
    expect(isSupportedCurrency("XAU")).toBe(false);
    expect(isSupportedCurrency("UYW")).toBe(false);
    // Added after the pinned list.
    expect(isSupportedCurrency("XCG")).toBe(true);
  });

  it("pins the minor unit where runtimes disagree", () => {
    const pinned = { HUF: 2, TWD: 2, ISK: 0, UGX: 0, JPY: 0, MGA: 0, KWD: 3, IQD: 3, ALL: 2, RSD: 2, XCG: 2 };
    expect(Object.fromEntries(Object.keys(pinned).map((currency) => [currency, getMinorUnitDigits(currency)]))).toEqual(pinned);
    expect(plain(formatPrice({ amount: 2950, currency: "HUF" }, "en"))).toBe("HUF 29.50");
    expect(plain(formatPrice({ amount: 2950, currency: "TWD" }, "en"))).toBe("NT$29.50");
    expect(plain(formatPrice({ amount: 150000, currency: "ALL" }, "en"))).toBe("ALL 1,500.00");
    expect(plain(formatPrice({ amount: 25000, currency: "IQD" }, "en"))).toBe("IQD 25.000");
    expect(plain(formatPrice({ amount: 1500, currency: "ISK" }, "en"))).toBe("ISK 1,500");
  });

  it("holds only upper-case codes with 0, 2 or 3 digits", () => {
    for (const [currency, digits] of Object.entries(CURRENCY_MINOR_UNIT_DIGITS)) {
      expect([currency, /^[A-Z]{3}$/.test(currency), [0, 2, 3].includes(digits)]).toEqual([currency, true, true]);
    }
  });

  it("formats every pinned currency with exactly its pinned digits on this runtime", () => {
    // The runtime's CLDR may count other digits; a price only means the pinned amount if the
    // formatter, given the pinned digits, prints them all and nothing else.
    for (const [currency, digits] of Object.entries(CURRENCY_MINOR_UNIT_DIGITS)) {
      const amount = 10 ** digits * 1234 + (digits === 0 ? 0 : 7);
      const fraction = digits === 0 ? "" : "0".repeat(digits - 1) + "7";
      for (const locale of ["en", "pl"] as const) {
        const number = /\d(?:[\d.,]*\d)?/.exec(formatPrice({ amount, currency }, locale))?.[0];
        const expected = locale === "en" ? `1,234${digits === 0 ? "" : "." + fraction}` : `1234${digits === 0 ? "" : "," + fraction}`;
        expect([currency, locale, number]).toEqual([currency, locale, expected]);
      }
    }
  });

  it("refuses to give a unit for a code it does not know, yet still shows a stored price in it", () => {
    expect(() => getMinorUnitDigits("HRK")).toThrow('getMinorUnitDigits: billing does not know the currency "HRK"');
    expect(plain(formatPrice({ amount: 2900, currency: "HRK" }, "en"))).toBe("HRK 29.00");
  });
});
