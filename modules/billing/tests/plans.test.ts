// Plan periods and grants, pure: periods run in local calendar days from the start day, months keep
// the day of the month (or take the last one), and a paid period starts where access ends.
import { getPeriodEnd, getPlanGrant, type EntitlementRecord, type Plan } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

const TIMEZONE = "Europe/Warsaw";
/** 3 October 2026, 10:00 in Warsaw (CEST). */
const NOW = new Date("2026-10-03T08:00:00Z");

function plan(period: Plan["period"]): Plan {
  return { id: "test", name: { en: "Test" }, price: { amount: 2900, currency: "PLN" }, period, features: [], isFeatured: false };
}

describe("getPeriodEnd", () => {
  it.each([
    ["a day", { unit: "day", count: 1 }, "2026-10-03T22:00:00Z"],
    ["30 days, across the change to winter time", { unit: "day", count: 30 }, "2026-11-01T23:00:00Z"],
    ["a week", { unit: "week", count: 1 }, "2026-10-09T22:00:00Z"],
    ["a month: every day up to 2 November", { unit: "month", count: 1 }, "2026-11-02T23:00:00Z"],
    ["three months", { unit: "month", count: 3 }, "2027-01-02T23:00:00Z"],
    ["a year", { unit: "year", count: 1 }, "2027-10-02T22:00:00Z"],
  ] as const)("ends %s after the start day", (_name, period, end) => {
    expect(getPeriodEnd(NOW, period, TIMEZONE)).toEqual(new Date(end));
  });

  it("counts the start day as the first day at any hour of it", () => {
    const lateEvening = new Date("2026-10-03T21:59:59Z");
    expect(getPeriodEnd(lateEvening, { unit: "day", count: 1 }, TIMEZONE)).toEqual(new Date("2026-10-03T22:00:00Z"));
  });

  it("takes the last day of a shorter month, leap years included", () => {
    const january31 = new Date("2027-01-31T10:00:00Z");
    expect(getPeriodEnd(january31, { unit: "month", count: 1 }, TIMEZONE)).toEqual(new Date("2027-02-27T23:00:00Z"));
    const leapJanuary31 = new Date("2028-01-31T10:00:00Z");
    expect(getPeriodEnd(leapJanuary31, { unit: "month", count: 1 }, TIMEZONE)).toEqual(new Date("2028-02-28T23:00:00Z"));
    const leapDay = new Date("2028-02-29T10:00:00Z");
    expect(getPeriodEnd(leapDay, { unit: "year", count: 1 }, TIMEZONE)).toEqual(new Date("2029-02-27T23:00:00Z"));
  });

  it("continues an end that starts a local day without a gap", () => {
    const end = new Date("2026-11-02T23:00:00Z");
    expect(getPeriodEnd(end, { unit: "month", count: 1 }, TIMEZONE)).toEqual(new Date("2026-12-02T23:00:00Z"));
  });
});

describe("getPlanGrant", () => {
  const MONTHLY = plan({ unit: "month", count: 1 });
  const ENDED_TRIAL: EntitlementRecord = { trialEndsAt: new Date("2026-09-30T22:00:00Z"), paidUntil: null, isLifetime: false };

  it("starts a period now when the account's access has ended", () => {
    expect(getPlanGrant(ENDED_TRIAL, MONTHLY, NOW, TIMEZONE)).toEqual({ type: "grant", until: new Date("2026-11-02T23:00:00Z") });
  });

  it("starts the period when a running trial ends, so paying early loses no day", () => {
    const trial: EntitlementRecord = { trialEndsAt: new Date("2026-10-16T22:00:00Z"), paidUntil: null, isLifetime: false };
    expect(getPlanGrant(trial, MONTHLY, NOW, TIMEZONE)).toEqual({ type: "grant", until: new Date("2026-11-16T23:00:00Z") });
  });

  it("starts the period when running paid access ends, and ignores paid access that ended", () => {
    const paid: EntitlementRecord = { ...ENDED_TRIAL, paidUntil: new Date("2026-11-02T23:00:00Z") };
    expect(getPlanGrant(paid, MONTHLY, NOW, TIMEZONE)).toEqual({ type: "grant", until: new Date("2026-12-02T23:00:00Z") });
    const lapsed: EntitlementRecord = { ...ENDED_TRIAL, paidUntil: new Date("2026-10-01T22:00:00Z") };
    expect(getPlanGrant(lapsed, MONTHLY, NOW, TIMEZONE)).toEqual({ type: "grant", until: new Date("2026-11-02T23:00:00Z") });
  });

  it("grants lifetime access for a lifetime plan", () => {
    expect(getPlanGrant(ENDED_TRIAL, plan({ unit: "lifetime" }), NOW, TIMEZONE)).toEqual({ type: "grant_lifetime" });
  });
});
