// The formatters of `/ui` an app uses in its own sentences: the bare day count and the numeric dates,
// and the module's copy with the app's overrides read through the Next.js adapter.
import { billingMessages, type BillingMessages } from "@softure-ai/billing";
import { getBillingMessages } from "@softure-ai/billing/next";
import { formatDayCount, formatShortDay, formatShortLastDay } from "@softure-ai/billing/ui";
import { describe, expect, it } from "vitest";
import { createConfig, TIMEZONE } from "./support.js";

describe("formatDayCount", () => {
  it.each([
    [0, "0 dni"],
    [1, "1 dzie\u0144"],
    [2, "2 dni"],
    [5, "5 dni"],
    [22, "22 dni"],
    [1.5, "1,5 dnia"],
  ])("says %s days in Polish as %j", (days, expected) => {
    expect(formatDayCount(days, "pl", billingMessages.pl)).toBe(expected);
  });

  it.each([
    [0, "0 days"],
    [1, "1 day"],
    [2, "2 days"],
    [22, "22 days"],
    [1000, "1,000 days"],
  ])("says %s days in English as %j", (days, expected) => {
    expect(formatDayCount(days, "en", billingMessages.en)).toBe(expected);
  });

  it("uses the app's dayCount override", () => {
    const messages: BillingMessages = { ...billingMessages.en, dayCount: { one: "{count} d", few: "{count} d", many: "{count} d", other: "{count} d" } };
    expect(formatDayCount(5, "en", messages)).toBe("5 d");
  });
});

describe("formatShortDay", () => {
  it("prints the local day as two-digit day and month and a four-digit year", () => {
    const instant = new Date("2026-11-22T10:00:00Z");
    expect(formatShortDay(instant, "pl", TIMEZONE)).toBe("22.11.2026");
    expect(formatShortDay(instant, "en", TIMEZONE)).toBe("11/22/2026");
  });

  it("takes the day in the app's time zone, not in UTC", () => {
    // 23:30 UTC on 21 November is already 22 November in Warsaw.
    expect(formatShortDay(new Date("2026-11-21T23:30:00Z"), "pl", TIMEZONE)).toBe("22.11.2026");
    expect(formatShortDay(new Date("2026-03-05T12:00:00Z"), "pl", TIMEZONE)).toBe("05.03.2026");
  });
});

describe("formatShortLastDay", () => {
  it("prints the last day with access: an end at a local midnight is the day before", () => {
    // Midnight of 23 November in Warsaw (CET, UTC+1).
    const end = new Date("2026-11-22T23:00:00Z");
    expect(formatShortLastDay(end, "pl", TIMEZONE)).toBe("22.11.2026");
    expect(formatShortLastDay(end, "en", TIMEZONE)).toBe("11/22/2026");
  });

  it("keeps the end's own day when the end falls inside a day", () => {
    expect(formatShortLastDay(new Date("2026-11-22T12:00:00Z"), "pl", TIMEZONE)).toBe("22.11.2026");
  });
});

describe("getBillingMessages from the Next.js adapter", () => {
  it("returns the locale's copy with the app's overrides merged over the defaults", () => {
    const config = createConfig({ messages: { en: { dayCount: { one: "{count} day of access", other: "{count} days of access" }, notice: { choosePlan: "See plans" } } } });
    const messages = getBillingMessages(config);
    expect(formatDayCount(1, "en", messages)).toBe("1 day of access");
    expect(formatDayCount(4, "en", messages)).toBe("4 days of access");
    expect(messages.notice.choosePlan).toBe("See plans");
    expect(messages.notice.trialEnded).toBe(billingMessages.en.notice.trialEnded);
    expect(messages.badge).toEqual(billingMessages.en.badge);
  });

  it("returns the defaults when the app overrides nothing", () => {
    expect(getBillingMessages(createConfig())).toEqual(billingMessages.en);
  });
});
