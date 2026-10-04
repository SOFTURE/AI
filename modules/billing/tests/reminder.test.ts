// Which reminder mail an account is due, as a pure rule over its record: the four states the
// in-app notice shows, an ended mail only for a few days after the end, and no "trial ended" mail
// for an account that never had a trial. Instants in Warsaw time.
import { getAccessReminder, getAccessReminderScope, type EntitlementPolicy, type EntitlementRecord } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

const POLICY: EntitlementPolicy = { timezone: "Europe/Warsaw", trialReminderDays: 3, paidReminderDays: 7 };
/** 3 October 2026, 10:00 in Warsaw: when the account was created. */
const CREATED = new Date("2026-10-03T08:00:00Z");
/** Midnight starting 17 October in Warsaw: the end of a 14-day trial begun on 3 October. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
/** Midnight starting 1 December in Warsaw (CET). */
const PAID_END = new Date("2026-11-30T23:00:00Z");
const TRIAL: EntitlementRecord = { trialEndsAt: TRIAL_END, paidUntil: null, isLifetime: false };
const PAID: EntitlementRecord = { ...TRIAL, paidUntil: PAID_END };

function decide(record: EntitlementRecord, now: string, options: { catchUpDays?: number; policy?: EntitlementPolicy; createdAt?: Date } = {}) {
  return getAccessReminder({
    record,
    accountCreatedAt: options.createdAt ?? CREATED,
    now: new Date(now),
    policy: options.policy ?? POLICY,
    catchUpDays: options.catchUpDays ?? 3,
  });
}

describe("getAccessReminder", () => {
  it("is due nothing while the trial is outside its reminder window", () => {
    expect(decide(TRIAL, "2026-10-03T08:00:00Z")).toBeNull();
    expect(decide(TRIAL, "2026-10-13T21:59:59Z")).toBeNull();
  });

  it("is due a trial-ending mail from the first reminder day to the last day of the trial", () => {
    expect(decide(TRIAL, "2026-10-13T22:00:00Z")).toEqual({ kind: "trial-ending", endsAt: TRIAL_END });
    expect(decide(TRIAL, "2026-10-16T21:59:59Z")).toEqual({ kind: "trial-ending", endsAt: TRIAL_END });
  });

  it("is due a paid-ending mail inside the renewal window", () => {
    expect(decide(PAID, "2026-11-23T22:59:59Z")).toBeNull();
    expect(decide(PAID, "2026-11-23T23:00:00Z")).toEqual({ kind: "paid-ending", endsAt: PAID_END });
  });

  it("is due nothing with lifetime access, also when its dated end has passed", () => {
    expect(decide({ ...PAID, isLifetime: true }, "2026-11-30T12:00:00Z")).toBeNull();
    expect(decide({ ...PAID, isLifetime: true }, "2026-12-01T12:00:00Z")).toBeNull();
  });

  it("is due a trial-ended mail from the end day through catchUpDays days after it", () => {
    expect(decide(TRIAL, "2026-10-16T22:00:00Z")).toEqual({ kind: "trial-ended", endsAt: TRIAL_END });
    // 20 October, 23:59 in Warsaw: three days after the end day.
    expect(decide(TRIAL, "2026-10-20T21:59:59Z")).toEqual({ kind: "trial-ended", endsAt: TRIAL_END });
    expect(decide(TRIAL, "2026-10-20T22:00:00Z")).toBeNull();
  });

  it("is due an ended mail on the end day only with catchUpDays 0", () => {
    expect(decide(TRIAL, "2026-10-17T21:59:59Z", { catchUpDays: 0 })).toEqual({ kind: "trial-ended", endsAt: TRIAL_END });
    expect(decide(TRIAL, "2026-10-17T22:00:00Z", { catchUpDays: 0 })).toBeNull();
  });

  it("is due a paid-ended mail with the paid end when paid access outlasted the trial", () => {
    expect(decide(PAID, "2026-12-01T12:00:00Z")).toEqual({ kind: "paid-ended", endsAt: PAID_END });
  });

  it("is due a trial-ending mail when paid access ended inside a longer trial", () => {
    const record: EntitlementRecord = { ...TRIAL, paidUntil: new Date("2026-10-09T22:00:00Z") };
    expect(decide(record, "2026-10-14T12:00:00Z")).toEqual({ kind: "trial-ending", endsAt: TRIAL_END });
  });

  it("is due no trial-ended mail when the account never had a trial", () => {
    const noTrial: EntitlementRecord = { trialEndsAt: new Date("2026-10-02T22:00:00Z"), paidUntil: null, isLifetime: false };
    expect(decide(noTrial, "2026-10-03T09:00:00Z")).toBeNull();
  });

  it("is due no ending mail with a reminder window of zero days", () => {
    const policy = { ...POLICY, trialReminderDays: 0, paidReminderDays: 0 };
    expect(decide(TRIAL, "2026-10-16T21:59:59Z", { policy })).toBeNull();
    expect(decide(PAID, "2026-11-30T22:59:59Z", { policy })).toBeNull();
    expect(decide(TRIAL, "2026-10-17T12:00:00Z", { policy })).toEqual({ kind: "trial-ended", endsAt: TRIAL_END });
  });
});

describe("getAccessReminderScope", () => {
  it("names the kind, the account and the end instant within mailing's scope limits", () => {
    const scope = getAccessReminderScope("trial-ending", "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b", TRIAL_END);
    expect(scope).toBe(`billing.trial-ending:6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b:${String(TRIAL_END.getTime())}`);
    expect(scope).toMatch(/^[a-z0-9][a-z0-9._:-]*$/);
    expect(scope.length).toBeLessThanOrEqual(128);
  });
});
