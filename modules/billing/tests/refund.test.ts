// Refunds, pure: what a plan grant added and what a full or partial refund of it takes back, at exact instants
// in Warsaw time (the tests themselves run in New York time), across the October DST change.
import { getPaymentGrant, getRefundEvent, getTakenBackDays, getUnusedDays, isFullShare, type EntitlementRecord, type PaymentGrant } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

const TIMEZONE = "Europe/Warsaw";
/** 3 October 2026, 10:00 in Warsaw. */
const NOW = new Date("2026-10-03T08:00:00Z");
/** Midnight starting 17 October in Warsaw (CEST): the end of a 14-day trial begun on 3 October. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
/** Midnight starting 17 November in Warsaw (CET): one month after the trial. */
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");
/** Midnight starting 17 December in Warsaw: a second month stacked on the first. */
const TWO_MONTHS_AFTER_TRIAL = new Date("2026-12-16T23:00:00Z");

const TRIAL: EntitlementRecord = { trialEndsAt: TRIAL_END, paidUntil: null, isLifetime: false };
const FIRST_MONTH: PaymentGrant = { kind: "period", from: TRIAL_END, until: MONTH_AFTER_TRIAL };
const SECOND_MONTH: PaymentGrant = { kind: "period", from: MONTH_AFTER_TRIAL, until: TWO_MONTHS_AFTER_TRIAL };
const STACKED: EntitlementRecord = { ...TRIAL, paidUntil: TWO_MONTHS_AFTER_TRIAL };

describe("getPaymentGrant", () => {
  it("records a period from the end of a running trial", () => {
    expect(getPaymentGrant(TRIAL, { type: "grant", until: MONTH_AFTER_TRIAL }, NOW)).toEqual(FIRST_MONTH);
  });

  it("records a period from the end of running paid access", () => {
    const paid = { ...TRIAL, paidUntil: MONTH_AFTER_TRIAL };
    expect(getPaymentGrant(paid, { type: "grant", until: TWO_MONTHS_AFTER_TRIAL }, NOW)).toEqual(SECOND_MONTH);
  });

  it("records a period from now once access has lapsed", () => {
    const later = new Date("2026-12-01T09:00:00Z");
    const lapsed = { ...TRIAL, paidUntil: MONTH_AFTER_TRIAL };
    const until = new Date("2026-12-31T23:00:00Z");
    expect(getPaymentGrant(lapsed, { type: "grant", until }, later)).toEqual({ kind: "period", from: later, until });
  });

  it("records lifetime access, and nothing for an event that is not a plan grant", () => {
    expect(getPaymentGrant(TRIAL, { type: "grant_lifetime" }, NOW)).toEqual({ kind: "lifetime" });
    expect(getPaymentGrant(TRIAL, { type: "revoke" }, NOW)).toBeNull();
    expect(getPaymentGrant(TRIAL, { type: "extend_trial", until: MONTH_AFTER_TRIAL }, NOW)).toBeNull();
    // A dated grant that ends before current access does adds nothing.
    expect(getPaymentGrant(STACKED, { type: "grant", until: MONTH_AFTER_TRIAL }, NOW)).toBeNull();
  });
});

describe("getUnusedDays", () => {
  const period = { kind: "period", from: TRIAL_END, until: MONTH_AFTER_TRIAL } as const;

  it("counts a future period whole, a running one from today, and an ended one as zero", () => {
    expect(getUnusedDays(period, NOW, TIMEZONE)).toBe(31);
    expect(getUnusedDays(period, new Date("2026-11-16T22:59:59Z"), TIMEZONE)).toBe(1);
    expect(getUnusedDays(period, MONTH_AFTER_TRIAL, TIMEZONE)).toBe(0);
  });
});

describe("getRefundEvent", () => {
  it("takes a future period's local days out of the stack, across the DST change", () => {
    // 31 days (17 October to 17 November) come off 17 December: the second month now ends on 16 November.
    expect(getRefundEvent(STACKED, FIRST_MONTH, { now: NOW, timezone: TIMEZONE })).toEqual({ type: "shorten", until: new Date("2026-11-15T23:00:00Z") });
    // The second month's 30 days come off: the first month stays as it was.
    expect(getRefundEvent(STACKED, SECOND_MONTH, { now: NOW, timezone: TIMEZONE })).toEqual({ type: "shorten", until: MONTH_AFTER_TRIAL });
  });

  it("takes back only the unused days of a running period, today included", () => {
    const running = new Date("2026-10-20T08:00:00Z");
    // 28 days (20 October to 17 November) come off: access ends when 20 October began.
    expect(getRefundEvent({ ...TRIAL, paidUntil: MONTH_AFTER_TRIAL }, FIRST_MONTH, { now: running, timezone: TIMEZONE })).toEqual({
      type: "shorten",
      until: new Date("2026-10-19T22:00:00Z"),
    });
  });

  it("takes nothing back for a period already used up", () => {
    expect(getRefundEvent(STACKED, FIRST_MONTH, { now: new Date("2026-11-20T08:00:00Z"), timezone: TIMEZONE })).toBeNull();
    expect(getRefundEvent(STACKED, FIRST_MONTH, { now: MONTH_AFTER_TRIAL, timezone: TIMEZONE })).toBeNull();
  });

  it("takes nothing back when dated access is already gone", () => {
    expect(getRefundEvent(TRIAL, FIRST_MONTH, { now: NOW, timezone: TIMEZONE })).toBeNull();
  });

  it("keeps the local time of day of an end that is not midnight", () => {
    const paidUntil = new Date("2026-12-01T14:30:00Z");
    const week: PaymentGrant = { kind: "period", from: new Date("2026-11-23T23:00:00Z"), until: new Date("2026-11-30T23:00:00Z") };
    expect(getRefundEvent({ ...TRIAL, paidUntil }, week, { now: NOW, timezone: TIMEZONE })).toEqual({ type: "shorten", until: new Date("2026-11-24T14:30:00Z") });
  });

  it("ends lifetime access for a refunded lifetime", () => {
    expect(getRefundEvent({ ...STACKED, isLifetime: true }, { kind: "lifetime" }, { now: NOW, timezone: TIMEZONE })).toEqual({ type: "end_lifetime" });
  });
});

describe("getTakenBackDays", () => {
  const period = { kind: "period", from: TRIAL_END, until: MONTH_AFTER_TRIAL } as const;
  const timing = { now: NOW, timezone: TIMEZONE };

  it("takes every unused day for a full refund, and for a share that covers what is left", () => {
    expect(getTakenBackDays(period, timing)).toBe(31);
    expect(getTakenBackDays(period, { ...timing, share: { refunded: 1450, outstanding: 1450 } })).toBe(31);
    expect(getTakenBackDays(period, { ...timing, share: { refunded: 2000, outstanding: 1450 } })).toBe(31);
  });

  it("takes the refunded share of the unused days, rounded down", () => {
    // 1450 of 2900 is half of 31 days: 15.5, so 15.
    expect(getTakenBackDays(period, { ...timing, share: { refunded: 1450, outstanding: 2900 } })).toBe(15);
    // 1 of 2900 is a sliver of a day: nothing.
    expect(getTakenBackDays(period, { ...timing, share: { refunded: 1, outstanding: 2900 } })).toBe(0);
    expect(getTakenBackDays(period, { ...timing, share: { refunded: 0, outstanding: 2900 } })).toBe(0);
  });

  it("takes nothing from a period already used up, whatever the share", () => {
    expect(getTakenBackDays(period, { now: MONTH_AFTER_TRIAL, timezone: TIMEZONE, share: { refunded: 1450, outstanding: 2900 } })).toBe(0);
  });

  it("calls a missing share or one that covers the rest full", () => {
    expect(isFullShare(undefined)).toBe(true);
    expect(isFullShare({ refunded: 2900, outstanding: 2900 })).toBe(true);
    expect(isFullShare({ refunded: 2899, outstanding: 2900 })).toBe(false);
  });
});

describe("getRefundEvent with a partial share", () => {
  const half = { refunded: 1450, outstanding: 2900 };

  it("moves dated access back by the share of the unused days", () => {
    // Half of the first month's 31 days: 15 come off 17 December, which then ends on 2 December.
    expect(getRefundEvent(STACKED, FIRST_MONTH, { now: NOW, timezone: TIMEZONE, share: half })).toEqual({ type: "shorten", until: new Date("2026-12-01T23:00:00Z") });
  });

  it("keeps lifetime access until the whole payment is refunded", () => {
    const lifetime = { ...STACKED, isLifetime: true };
    expect(getRefundEvent(lifetime, { kind: "lifetime" }, { now: NOW, timezone: TIMEZONE, share: half })).toBeNull();
    expect(getRefundEvent(lifetime, { kind: "lifetime" }, { now: NOW, timezone: TIMEZONE, share: { refunded: 1450, outstanding: 1450 } })).toEqual({ type: "end_lifetime" });
  });

  it("takes nothing when the share rounds to no day", () => {
    expect(getRefundEvent(STACKED, FIRST_MONTH, { now: NOW, timezone: TIMEZONE, share: { refunded: 1, outstanding: 2900 } })).toBeNull();
  });
});
