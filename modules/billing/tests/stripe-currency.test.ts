// Stripe's unit per currency against billing's (`Intl`'s minor unit): ISK and UGX are sent ×100,
// zero- and three-decimal currencies unchanged, HUF and TWD charged as two-decimal (Stripe's
// divisible-by-100 rule is for payouts), and what cannot be charged exactly is refused.
import {
  describeStripePriceProblem,
  fromStripeAmount,
  getMinorUnitDigits,
  getStripeMinorUnitDigits,
  STRIPE_THREE_DECIMAL_CURRENCIES,
  STRIPE_ZERO_DECIMAL_CURRENCIES,
  toStripeAmount,
} from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

describe("Stripe's currency units", () => {
  it("knows Stripe's digits: zero- and three-decimal lists, two otherwise", () => {
    expect(getStripeMinorUnitDigits("JPY")).toBe(0);
    expect(getStripeMinorUnitDigits("KWD")).toBe(3);
    expect(getStripeMinorUnitDigits("PLN")).toBe(2);
    // Stripe's special cases: zero-decimal in name, sent as two-decimal values ending in 00.
    expect(getStripeMinorUnitDigits("ISK")).toBe(2);
    expect(getStripeMinorUnitDigits("UGX")).toBe(2);
  });

  it("agrees with Intl on every Stripe zero- and three-decimal currency", () => {
    for (const currency of STRIPE_ZERO_DECIMAL_CURRENCIES) expect([currency, getMinorUnitDigits(currency)]).toEqual([currency, 0]);
    for (const currency of STRIPE_THREE_DECIMAL_CURRENCIES) expect([currency, getMinorUnitDigits(currency)]).toEqual([currency, 3]);
  });

  it("scales currencies Intl shows without decimals that Stripe takes with two", () => {
    expect(toStripeAmount({ amount: 1500, currency: "ISK" })).toBe(150000);
    expect(toStripeAmount({ amount: 5000, currency: "UGX" })).toBe(500000);
    expect(toStripeAmount({ amount: 1500, currency: "ALL" })).toBe(150000);
    expect(toStripeAmount({ amount: 0, currency: "ISK" })).toBe(0);
  });

  it("sends two-, zero- and three-decimal amounts unchanged", () => {
    expect(toStripeAmount({ amount: 2900, currency: "PLN" })).toBe(2900);
    expect(toStripeAmount({ amount: 1500, currency: "JPY" })).toBe(1500);
    // HUF and TWD: two-decimal charges; only payouts must be divisible by 100.
    expect(toStripeAmount({ amount: 2950, currency: "HUF" })).toBe(2950);
    expect(toStripeAmount({ amount: 80045, currency: "TWD" })).toBe(80045);
    expect(toStripeAmount({ amount: 1250, currency: "KWD" })).toBe(1250);
  });

  it("refuses what Stripe cannot charge exactly, saying why", () => {
    expect(toStripeAmount({ amount: 12345, currency: "KWD" })).toBeNull();
    expect(describeStripePriceProblem({ amount: 12345, currency: "KWD" })).toBe("stripe() charges KWD in multiples of 10 of its minor unit; round the amount to end in 0");
    // LYD: three decimals in Intl, not a Stripe three-decimal currency.
    expect(toStripeAmount({ amount: 1230, currency: "LYD" })).toBe(123);
    expect(toStripeAmount({ amount: 1234, currency: "LYD" })).toBeNull();
    expect(describeStripePriceProblem({ amount: 1234, currency: "LYD" })).toBe("stripe() charges LYD with 2 decimals; the amount must be a whole number of them");
    expect(describeStripePriceProblem({ amount: 1500, currency: "ISK" })).toBeNull();
  });

  it("has a problem exactly when the amount cannot be converted, for every currency", () => {
    for (const currency of Intl.supportedValuesOf("currency")) {
      for (const amount of [0, 1, 10, 1234, 99990]) {
        const price = { amount, currency };
        expect([currency, amount, describeStripePriceProblem(price) === null]).toEqual([currency, amount, toStripeAmount(price) !== null]);
      }
    }
  });

  it("reads Stripe's amounts back in billing's unit, rounding a fraction down", () => {
    expect(fromStripeAmount(150000, "ISK")).toBe(1500);
    expect(fromStripeAmount(150050, "ALL")).toBe(1500);
    expect(fromStripeAmount(2900, "PLN")).toBe(2900);
    expect(fromStripeAmount(1500, "JPY")).toBe(1500);
    expect(fromStripeAmount(1250, "KWD")).toBe(1250);
    expect(fromStripeAmount(123, "LYD")).toBe(1230);
    for (const price of [{ amount: 1500, currency: "ISK" }, { amount: 2900, currency: "PLN" }, { amount: 1230, currency: "LYD" }]) {
      expect(fromStripeAmount(toStripeAmount(price) ?? Number.NaN, price.currency)).toBe(price.amount);
    }
  });
});
