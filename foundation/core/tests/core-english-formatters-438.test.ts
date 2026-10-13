import { describe, expect, it } from "vitest";
import {
  coreMessages,
  DEFAULT_DURATION_MESSAGES,
  formatCalendarDay,
  formatCalendarMonth,
  formatDuration,
  formatMoney,
  formatPercent,
  selectPlural,
  type DurationMessages,
} from "@softure-ai/core";

/** `Intl` puts no-break and narrow no-break spaces between the parts; the tests compare plain spaces. */
function plain(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, " ");
}

const GERMAN_DURATION: DurationMessages = {
  years: { one: "{count} Jahr", other: "{count} Jahre" },
  months: { one: "{count} Monat", other: "{count} Monate" },
  both: "{years} und {months}",
};

describe("formatDuration defaults", () => {
  it("writes English without any options", () => {
    expect(formatDuration(38)).toBe("3 years and 2 months");
    expect(formatDuration(1)).toBe("1 month");
    expect(formatDuration(12)).toBe("1 year");
    expect(formatDuration(0)).toBe("0 months");
  });

  it("keeps the English words when only a locale is given, whatever its plural categories", () => {
    expect(formatDuration(38, { locale: "pl" })).toBe("3 years and 2 months");
    expect(formatDuration(5, { locale: "pl" })).toBe("5 months");
    expect(formatDuration(13, { locale: "pl" })).toBe("1 year and 1 month");
  });

  it("ships English forms only", () => {
    expect(DEFAULT_DURATION_MESSAGES).toEqual({
      years: { one: "{count} year", other: "{count} years" },
      months: { one: "{count} month", other: "{count} months" },
      both: "{years} and {months}",
    });
  });
});

describe("formatDuration with an app's own translation", () => {
  it("uses the app's words with the locale's plural rules", () => {
    expect(formatDuration(13, { locale: "de", messages: GERMAN_DURATION })).toBe("1 Jahr und 1 Monat");
    expect(formatDuration(24, { locale: "de", messages: GERMAN_DURATION })).toBe("2 Jahre");
    expect(formatDuration(5, { locale: "de", messages: GERMAN_DURATION })).toBe("5 Monate");
    expect(formatDuration(0, { locale: "de", messages: GERMAN_DURATION })).toBe("0 Monate");
  });

  it("picks richer plural categories when the app supplies them", () => {
    const messages: DurationMessages = {
      years: { one: "{count} y-one", few: "{count} y-few", many: "{count} y-many", other: "{count} y-other" },
      months: { one: "{count} m-one", few: "{count} m-few", many: "{count} m-many", other: "{count} m-other" },
      both: "{years} + {months}",
    };
    expect(formatDuration(38, { locale: "pl", messages })).toBe("3 y-few + 2 m-few");
    expect(formatDuration(65, { locale: "pl", messages })).toBe("5 y-many + 5 m-many");
  });

  it("rejects an invalid locale tag", () => {
    expect(() => formatDuration(1, { locale: "not a locale" })).toThrow(RangeError);
  });
});

describe("formatCalendarMonth styles", () => {
  it("has no language-specific style", () => {
    // @ts-expect-error The genitive style was removed (#438).
    const removed: Parameters<typeof formatCalendarMonth>[2] = "genitive";
    expect(removed).toBe("genitive");
  });
});

describe("formatters with a locale other than en", () => {
  it("write a date, a month, money and a percentage as Intl does for that locale", () => {
    expect(formatCalendarDay("2026-10-04", "de")).toBe("4. Oktober 2026");
    expect(formatCalendarDay("2026-10-04", "de", "numeric")).toBe("04.10.2026");
    expect(formatCalendarMonth("2026-10", "de")).toBe("Oktober 2026");
    expect(plain(formatMoney(123456, "EUR", "de"))).toBe("1.234,56 \u20ac");
    expect(plain(formatPercent(1250, "de"))).toBe("12,5 %");
    expect(formatPercent(1250, "de", { tight: true })).toBe("12,5%");
  });

  it("pick a plural form under that locale's rules", () => {
    expect(selectPlural("de", 1, { one: "one", other: "other" })).toBe("one");
    expect(selectPlural("de", 2, { one: "one", other: "other" })).toBe("other");
  });

  it("throw a RangeError for an invalid tag", () => {
    expect(() => formatCalendarDay("2026-10-04", "not a locale")).toThrow(RangeError);
    expect(() => formatMoney(100, "EUR", "not a locale")).toThrow(RangeError);
  });
});

describe("core messages", () => {
  it("carry no formatter copy", () => {
    expect(Object.keys(coreMessages.en)).toEqual(["errors"]);
  });
});
