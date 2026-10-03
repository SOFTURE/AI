// The state machine: every status an entitlement record can resolve to, and every transition an
// event makes, at exact instants in Warsaw time (the tests themselves run in New York time).
import { applyEntitlementEvent, resolveEntitlement, type EntitlementPolicy, type EntitlementRecord } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

const POLICY: EntitlementPolicy = { timezone: "Europe/Warsaw", trialReminderDays: 3, paidReminderDays: 7 };
/** 3 October 2026, 10:00 in Warsaw. */
const NOW = new Date("2026-10-03T08:00:00Z");
/** Midnight starting 17 October in Warsaw: the end of a 14-day trial begun on 3 October. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
/** Midnight starting 1 December in Warsaw (CET). */
const PAID_END = new Date("2026-11-30T23:00:00Z");

const TRIAL: EntitlementRecord = { trialEndsAt: TRIAL_END, paidUntil: null, isLifetime: false };
const PAID: EntitlementRecord = { ...TRIAL, paidUntil: PAID_END };
const LIFETIME: EntitlementRecord = { ...TRIAL, isLifetime: true };

function at(iso: string): Date {
  return new Date(iso);
}

describe("resolveEntitlement", () => {
  it("puts a fresh account on its trial, counting today as a day", () => {
    expect(resolveEntitlement(TRIAL, NOW, POLICY)).toEqual({ status: "trial", endsAt: TRIAL_END, daysLeft: 14, isEnding: false });
  });

  it("marks the trial as ending from the reminder window on, down to one day left", () => {
    expect(resolveEntitlement(TRIAL, at("2026-10-13T21:59:59Z"), POLICY)).toMatchObject({ daysLeft: 4, isEnding: false });
    expect(resolveEntitlement(TRIAL, at("2026-10-13T22:00:00Z"), POLICY)).toMatchObject({ daysLeft: 3, isEnding: true });
    expect(resolveEntitlement(TRIAL, at("2026-10-16T21:59:59Z"), POLICY)).toMatchObject({ status: "trial", daysLeft: 1, isEnding: true });
  });

  it("makes the account read-only at the trial end itself", () => {
    expect(resolveEntitlement(TRIAL, TRIAL_END, POLICY)).toEqual({ status: "read_only", since: TRIAL_END, reason: "trial_ended" });
  });

  it("lets paid access win over a running trial", () => {
    expect(resolveEntitlement(PAID, NOW, POLICY)).toEqual({ status: "paid", endsAt: PAID_END, daysLeft: 59, isEnding: false });
  });

  it("marks paid access as ending inside its own reminder window", () => {
    expect(resolveEntitlement(PAID, at("2026-11-23T22:59:59Z"), POLICY)).toMatchObject({ status: "paid", daysLeft: 8, isEnding: false });
    expect(resolveEntitlement(PAID, at("2026-11-23T23:00:00Z"), POLICY)).toMatchObject({ status: "paid", daysLeft: 7, isEnding: true });
  });

  it("makes the account read-only when paid access ends after the trial", () => {
    expect(resolveEntitlement(PAID, PAID_END, POLICY)).toEqual({ status: "read_only", since: PAID_END, reason: "paid_ended" });
  });

  it("falls back to a trial that outlasts paid access", () => {
    const shortPaid = { ...TRIAL, paidUntil: at("2026-10-10T22:00:00Z") };
    expect(resolveEntitlement(shortPaid, at("2026-10-12T08:00:00Z"), POLICY)).toEqual({ status: "trial", endsAt: TRIAL_END, daysLeft: 5, isEnding: false });
    expect(resolveEntitlement(shortPaid, TRIAL_END, POLICY)).toEqual({ status: "read_only", since: TRIAL_END, reason: "trial_ended" });
  });

  it("keeps lifetime access paid forever, never ending", () => {
    expect(resolveEntitlement(LIFETIME, at("2099-01-01T00:00:00Z"), POLICY)).toEqual({ status: "paid", endsAt: null, daysLeft: null, isEnding: false });
  });

  it("never marks access as ending with a reminder window of zero days", () => {
    const silent = { ...POLICY, trialReminderDays: 0, paidReminderDays: 0 };
    expect(resolveEntitlement(TRIAL, at("2026-10-16T21:00:00Z"), silent)).toMatchObject({ daysLeft: 1, isEnding: false });
    expect(resolveEntitlement(PAID, at("2026-11-30T22:00:00Z"), silent)).toMatchObject({ daysLeft: 1, isEnding: false });
  });
});

describe("applyEntitlementEvent", () => {
  it("grants paid access to an account on its trial", () => {
    expect(applyEntitlementEvent(TRIAL, { type: "grant", until: PAID_END }, NOW)).toEqual({ ok: true, value: PAID });
  });

  it("extends paid access with a later grant and never shortens it with an earlier one", () => {
    const later = at("2026-12-31T23:00:00Z");
    expect(applyEntitlementEvent(PAID, { type: "grant", until: later }, NOW)).toEqual({ ok: true, value: { ...PAID, paidUntil: later } });
    expect(applyEntitlementEvent(PAID, { type: "grant", until: at("2026-11-01T00:00:00Z") }, NOW)).toEqual({ ok: true, value: PAID });
  });

  it("brings a read-only account back with a grant", () => {
    const ended = at("2026-10-20T08:00:00Z");
    const granted = applyEntitlementEvent(TRIAL, { type: "grant", until: PAID_END }, ended);
    expect(granted.ok && resolveEntitlement(granted.value, ended, POLICY).status).toBe("paid");
  });

  it("refuses a grant or a trial extension that ends now or earlier", () => {
    expect(applyEntitlementEvent(TRIAL, { type: "grant", until: NOW }, NOW)).toEqual({ ok: false, error: "billing.end_not_in_future" });
    expect(applyEntitlementEvent(TRIAL, { type: "extend_trial", until: at("2026-10-01T00:00:00Z") }, NOW)).toEqual({ ok: false, error: "billing.end_not_in_future" });
  });

  it("leaves lifetime access as it is on a dated grant", () => {
    expect(applyEntitlementEvent(LIFETIME, { type: "grant", until: PAID_END }, NOW)).toEqual({ ok: true, value: LIFETIME });
  });

  it("turns any access into lifetime access, dropping its end", () => {
    expect(applyEntitlementEvent(PAID, { type: "grant_lifetime" }, NOW)).toEqual({ ok: true, value: LIFETIME });
  });

  it("revokes paid access back to the trial, or to read-only once the trial is over", () => {
    expect(applyEntitlementEvent(PAID, { type: "revoke" }, NOW)).toEqual({ ok: true, value: TRIAL });
    const revoked = applyEntitlementEvent(LIFETIME, { type: "revoke" }, at("2026-11-02T08:00:00Z"));
    expect(revoked).toEqual({ ok: true, value: TRIAL });
    expect(revoked.ok && resolveEntitlement(revoked.value, at("2026-11-02T08:00:00Z"), POLICY)).toEqual({ status: "read_only", since: TRIAL_END, reason: "trial_ended" });
  });

  it("extends the trial and never shortens it", () => {
    const later = at("2026-10-23T22:00:00Z");
    expect(applyEntitlementEvent(TRIAL, { type: "extend_trial", until: later }, NOW)).toEqual({ ok: true, value: { ...TRIAL, trialEndsAt: later } });
    expect(applyEntitlementEvent(TRIAL, { type: "extend_trial", until: at("2026-10-10T22:00:00Z") }, NOW)).toEqual({ ok: true, value: TRIAL });
  });

  it("does not touch the input record", () => {
    const record = { ...TRIAL };
    applyEntitlementEvent(record, { type: "grant", until: PAID_END }, NOW);
    expect(record).toEqual(TRIAL);
  });
});
