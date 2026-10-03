// Prices in the currency's minor unit, formatted by the locale.
import { formatPrice, getMinorUnitDigits, isSupportedCurrency } from "@softure-ai/billing";
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

  it("tells a known currency code from a made-up one", () => {
    expect(isSupportedCurrency("PLN")).toBe(true);
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(isSupportedCurrency("pln")).toBe(false);
  });
});
