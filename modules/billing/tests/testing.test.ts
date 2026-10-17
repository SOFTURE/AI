// The test factory of @softure-ai/billing/testing: rows written as a fixture would, and accounts put in a
// named state relative to the clock, read back through `getEntitlement`.
import { getEntitlement } from "@softure-ai/billing/server";
import { createTestEntitlement, setTestEntitlementState } from "@softure-ai/billing/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** The end of a 14-day trial begun at NOW: midnight starting 17 October in Warsaw. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const PAID_END = new Date("2026-11-30T23:00:00Z");
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("createTestEntitlement", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("writes the derived trial when given a context and nothing else", async () => {
    expect(await createTestEntitlement(test.ctx, { userId: adaId })).toEqual({ trialEndsAt: TRIAL_END, paidUntil: null, isLifetime: false });
    expect(await readRow(test, adaId)).toEqual({ trial_ends_at: TRIAL_END, paid_until: null, is_lifetime: false, created_at: NOW, updated_at: NOW });
  });

  it("ends the trial at the account's creation when given a bare database without a trial end", async () => {
    await createTestEntitlement(test.database.db, { userId: adaId, paidUntil: PAID_END, now: NOW });
    expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: NOW, paid_until: PAID_END, is_lifetime: false });
    expect(await getEntitlement(test.ctx, adaId)).toEqual({ status: "paid", endsAt: PAID_END, daysLeft: 59, isEnding: false });
  });

  it("overwrites the row on a second call and keeps updated_at after created_at", async () => {
    await createTestEntitlement(test.ctx, { userId: adaId, paidUntil: PAID_END });
    const earlier = new Date(NOW.getTime() - DAY_MS);
    await createTestEntitlement(test.database.db, { userId: adaId, trialEndsAt: TRIAL_END, lifetime: true, now: earlier });
    expect(await readRow(test, adaId)).toEqual({ trial_ends_at: TRIAL_END, paid_until: null, is_lifetime: true, created_at: NOW, updated_at: NOW });
    expect(await getEntitlement(test.ctx, adaId)).toEqual({ status: "paid", endsAt: null, daysLeft: null, isEnding: false });
  });

  it("throws for an account that does not exist", async () => {
    await expect(createTestEntitlement(test.ctx, { userId: UNKNOWN_ID })).rejects.toThrow(/no account/);
  });
});

describe("setTestEntitlementState", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("puts the account on a trial ending in the given number of days", async () => {
    await setTestEntitlementState(test.ctx, { userId: adaId, state: { status: "trial", days: 2 } });
    expect(await getEntitlement(test.ctx, adaId)).toEqual({ status: "trial", endsAt: new Date(NOW.getTime() + 2 * DAY_MS), daysLeft: 3, isEnding: true });
  });

  it("puts the account on paid access, dated or lifetime", async () => {
    await setTestEntitlementState(test.ctx, { userId: adaId, state: { status: "paid" } });
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: new Date(NOW.getTime() + 30 * DAY_MS) });
    await setTestEntitlementState(test.ctx, { userId: adaId, state: { status: "lifetime" } });
    expect(await getEntitlement(test.ctx, adaId)).toEqual({ status: "paid", endsAt: null, daysLeft: null, isEnding: false });
  });

  it("makes the account read-only after its trial or after its paid access", async () => {
    await setTestEntitlementState(test.ctx, { userId: adaId, state: { status: "read_only" } });
    expect(await getEntitlement(test.ctx, adaId)).toEqual({ status: "read_only", since: new Date(NOW.getTime() - DAY_MS), reason: "trial_ended" });
    await setTestEntitlementState(test.ctx, { userId: adaId, state: { status: "read_only", reason: "paid_ended", days: 3 } });
    expect(await getEntitlement(test.ctx, adaId)).toEqual({ status: "read_only", since: new Date(NOW.getTime() - 3 * DAY_MS), reason: "paid_ended" });
  });

  it("counts from the given instant with a bare database", async () => {
    const later = new Date(NOW.getTime() + 40 * DAY_MS);
    await setTestEntitlementState(test.database.db, { userId: adaId, state: { status: "trial", days: 1 }, now: later });
    test.clock.set(later);
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial", endsAt: new Date(later.getTime() + DAY_MS) });
  });
});
