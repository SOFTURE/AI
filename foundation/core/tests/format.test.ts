import { describe, expect, it } from "vitest";
import { CURRENCY_MINOR_UNIT_DIGITS, formatCalendarDay, formatMoney, formatPercent } from "@softure-ai/core";

/** `Intl` puts no-break and narrow no-break spaces between the parts; the tests compare plain spaces. */
function plain(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, " ");
}

describe("formatCalendarDay", () => {
  it("writes the day in full by default, the Polish month in the genitive", () => {
    expect(formatCalendarDay("2026-10-04", "en")).toBe("October 4, 2026");
    expect(formatCalendarDay("2026-10-04", "pl")).toBe("4 pa\u017adziernika 2026");
    expect(formatCalendarDay("2026-10-04", "en", "long")).toBe("October 4, 2026");
  });

  it("writes the medium and numeric styles", () => {
    expect(formatCalendarDay("2026-10-04", "en", "medium")).toBe("Oct 4, 2026");
    expect(formatCalendarDay("2026-10-04", "en", "numeric")).toBe("10/04/2026");
    expect(formatCalendarDay("2026-10-04", "pl", "numeric")).toBe("04.10.2026");
  });

  it("keeps the day whatever the process zone (the tests run in New York)", () => {
    expect(formatCalendarDay("2026-01-01", "en")).toBe("January 1, 2026");
    expect(formatCalendarDay("2026-03-29", "pl", "numeric")).toBe("29.03.2026");
  });

  it("rejects a malformed day", () => {
    expect(() => formatCalendarDay("2026-02-30", "en")).toThrow(new RangeError('formatCalendarDay: "2026-02-30" is not a YYYY-MM-DD calendar day'));
  });
});

describe("formatMoney", () => {
  it("reads the amount in the currency's minor unit and groups thousands always", () => {
    expect(plain(formatMoney(2900, "PLN", "en"))).toBe("PLN 29.00");
    expect(plain(formatMoney(2900, "PLN", "pl"))).toBe("29,00 z\u0142");
    expect(plain(formatMoney(123456, "EUR", "pl"))).toBe("1 234,56 \u20ac");
    expect(plain(formatMoney(123456, "PLN", "en"))).toBe("PLN 1,234.56");
    expect(plain(formatMoney(1500, "JPY", "en"))).toBe("\u00a51,500");
    expect(plain(formatMoney(1250, "KWD", "en"))).toBe("KWD 1.250");
    expect(plain(formatMoney(0, "PLN", "en"))).toBe("PLN 0.00");
  });

  it("follows the pinned ISO 4217 digits where a runtime's CLDR differs", () => {
    expect(CURRENCY_MINOR_UNIT_DIGITS.IQD).toBe(3);
    expect(plain(formatMoney(25000, "IQD", "en"))).toBe("IQD 25.000");
    expect(plain(formatMoney(2950, "HUF", "en"))).toBe("HUF 29.50");
  });

  it("rounds to whole units on request", () => {
    expect(plain(formatMoney(123456, "PLN", "pl", { rounded: true }))).toBe("1 235 z\u0142");
    expect(plain(formatMoney(2949, "PLN", "en", { rounded: true }))).toBe("PLN 29");
  });

  it("signs the amount on request, never zero", () => {
    expect(plain(formatMoney(2900, "PLN", "en", { signed: true }))).toBe("+PLN 29.00");
    expect(plain(formatMoney(-2900, "PLN", "pl", { signed: true }))).toBe("-29,00 z\u0142");
    expect(plain(formatMoney(0, "PLN", "en", { signed: true }))).toBe("PLN 0.00");
    expect(plain(formatMoney(-123456, "PLN", "pl", { signed: true, rounded: true }))).toBe("-1 235 z\u0142");
  });

  it("writes large amounts compactly on request", () => {
    expect(plain(formatMoney(123456780, "PLN", "en", { compact: true }))).toBe("PLN 1.2M");
    expect(plain(formatMoney(123456780, "PLN", "pl", { compact: true }))).toBe("1,2 mln z\u0142");
  });

  it("shows a code outside the pinned table with Intl's digits", () => {
    expect(plain(formatMoney(2900, "HRK", "en"))).toBe("HRK 29.00");
  });

  it("rejects an amount that is not a whole number of minor units", () => {
    expect(() => formatMoney(29.5, "PLN", "en")).toThrow(new RangeError("formatMoney: 29.5 is not a whole number of minor units"));
    expect(() => formatMoney(Number.NaN, "PLN", "en")).toThrow(RangeError);
  });
});

describe("formatPercent", () => {
  it("reads basis points: 10000 is 100%", () => {
    expect(plain(formatPercent(1250, "en"))).toBe("12.5%");
    expect(plain(formatPercent(1250, "pl"))).toBe("12,5%");
    expect(plain(formatPercent(10000, "en"))).toBe("100%");
    expect(plain(formatPercent(0, "en"))).toBe("0%");
    expect(plain(formatPercent(1, "en"))).toBe("0.01%");
    expect(plain(formatPercent(-275, "en"))).toBe("-2.75%");
  });

  it("rejects a value that is not a number", () => {
    expect(() => formatPercent(Number.POSITIVE_INFINITY, "en")).toThrow(new RangeError("formatPercent: Infinity is not a finite number of basis points"));
  });
});
