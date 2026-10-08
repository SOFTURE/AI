// Trials extended by hand on PGlite: the trial end moves later and is recorded with the end before
// and after, paid access is never written, a refusal writes nothing (not even the pinned row), and
// the account's history lists the extension beside grants and payments. Also: every foreign key of
// billing's tables has an index that starts with its column (migration 0010).
import { type BillingOptionsInput } from "@softure-ai/billing";
import { changeEntitlement, extendTrialManually, getAccountHistory, getEntitlement, grantPlanManually } from "@softure-ai/billing/server";
import { err } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }];
/** The end of the 14-day trial begun at NOW (16 October, Warsaw, is its last day). */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
/** Through 31 October and 30 November (Warsaw): CET from 25 October. */
const OCTOBER_END = new Date("2026-10-31T23:00:00Z");
const NOVEMBER_END = new Date("2026-11-30T23:00:00Z");
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

interface TrialExtensionRow {
  user_id: string;
  extended_by: string | null;
  extended_at: Date;
  previous_ends_at: Date;
  ends_at: Date;
}

async function readExtensions(test: TestBilling): Promise<TrialExtensionRow[]> {
  const result = await test.database.client.query<TrialExtensionRow>(
    "SELECT user_id, extended_by, extended_at, previous_ends_at, ends_at FROM billing.trial_extensions ORDER BY extended_at, ends_at",
  );
  return result.rows;
}

describe("extendTrialManually", () => {
  let test: TestBilling;
  let adaId: string;
  let adminId: string;

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
    adminId = await createAccount(test, "admin@example.com");
  });
  afterEach(() => test.database.close());

  it("moves the derived trial's end later, pins it into a row and records the extension", async () => {
    const result = await extendTrialManually(test.ctx, { userId: adaId, until: OCTOBER_END, adminId });
    expect(result).toEqual({ ok: true, value: { extensionId: expect.any(String) as unknown, entitlement: { status: "trial", endsAt: OCTOBER_END, daysLeft: 29, isEnding: false } } });
    expect(await readRow(test, adaId)).toEqual({ trial_ends_at: OCTOBER_END, paid_until: null, is_lifetime: false, created_at: NOW, updated_at: NOW });
    expect(await readExtensions(test)).toEqual([{ user_id: adaId, extended_by: adminId, extended_at: NOW, previous_ends_at: TRIAL_END, ends_at: OCTOBER_END }]);
  });

  it("extends a trial that already ended, so a read-only account may write again", async () => {
    test.clock.set(new Date("2026-10-20T08:00:00Z"));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "read_only", reason: "trial_ended" });
    const result = await extendTrialManually(test.ctx, { userId: adaId, until: OCTOBER_END, adminId: null });
    expect(result.ok && result.value.entitlement).toMatchObject({ status: "trial", endsAt: OCTOBER_END });
    expect(await readExtensions(test)).toMatchObject([{ extended_by: null, previous_ends_at: TRIAL_END, ends_at: OCTOBER_END }]);
  });

  it("extends from the latest end each time, never writing paid access", async () => {
    await extendTrialManually(test.ctx, { userId: adaId, until: OCTOBER_END, adminId });
    test.clock.set(new Date("2026-10-05T08:00:00Z"));
    await extendTrialManually(test.ctx, { userId: adaId, until: NOVEMBER_END, adminId });
    expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: NOVEMBER_END, paid_until: null });
    expect((await readExtensions(test)).map((row) => [row.previous_ends_at, row.ends_at])).toEqual([
      [TRIAL_END, OCTOBER_END],
      [OCTOBER_END, NOVEMBER_END],
    ]);
  });

  it("extends the trial under paid access, which still wins", async () => {
    await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId });
    const result = await extendTrialManually(test.ctx, { userId: adaId, until: OCTOBER_END, adminId });
    expect(result.ok && result.value.entitlement).toMatchObject({ status: "paid", endsAt: new Date("2026-11-16T23:00:00Z") });
    expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: OCTOBER_END, paid_until: new Date("2026-11-16T23:00:00Z") });
  });

  it.each([
    ["an end before the current trial end", new Date("2026-10-10T22:00:00Z"), "billing.trial_not_extended"],
    ["the current trial end itself", TRIAL_END, "billing.trial_not_extended"],
    ["an end at now", NOW, "billing.end_not_in_future"],
    ["an end in the past", new Date("2026-10-01T22:00:00Z"), "billing.end_not_in_future"],
  ] as const)("refuses %s and writes nothing, not even the pinned row", async (_case, until, code) => {
    expect(await extendTrialManually(test.ctx, { userId: adaId, until, adminId })).toEqual(err(code));
    expect(await readRow(test, adaId)).toBeUndefined();
    expect(await readExtensions(test)).toEqual([]);
  });

  it("refuses an end before the stored trial end and leaves the row as it was", async () => {
    await changeEntitlement(test.ctx, adaId, { type: "extend_trial", until: NOVEMBER_END });
    expect(await extendTrialManually(test.ctx, { userId: adaId, until: OCTOBER_END, adminId })).toEqual(err("billing.trial_not_extended"));
    expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: NOVEMBER_END });
    expect(await readExtensions(test)).toEqual([]);
  });

  it("refuses an unknown or malformed account id", async () => {
    expect(await extendTrialManually(test.ctx, { userId: UNKNOWN_ID, until: OCTOBER_END, adminId })).toEqual(err("billing.account_unknown"));
    expect(await extendTrialManually(test.ctx, { userId: "not-a-uuid", until: OCTOBER_END, adminId })).toEqual(err("billing.account_unknown"));
    expect(await readExtensions(test)).toEqual([]);
  });

  it("lists extensions in the account's history beside its grants, newest first", async () => {
    const extended = await extendTrialManually(test.ctx, { userId: adaId, until: OCTOBER_END, adminId });
    const later = new Date("2026-10-04T08:00:00Z");
    test.clock.set(later);
    await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId });
    const history = await getAccountHistory(test.ctx, adaId);
    expect(history.map((entry) => entry.source)).toEqual(["manual", "trial"]);
    expect(history[1]).toEqual({ source: "trial", id: extended.ok ? extended.value.extensionId : "", at: NOW, previousEndsAt: TRIAL_END, endsAt: OCTOBER_END });
  });

  it("drops the admin from an extension when the admin's account is deleted, and the extension with its account", async () => {
    await extendTrialManually(test.ctx, { userId: adaId, until: OCTOBER_END, adminId });
    await test.database.client.query("DELETE FROM auth.users WHERE id = $1", [adminId]);
    expect(await readExtensions(test)).toMatchObject([{ user_id: adaId, extended_by: null }]);
    await test.database.client.query("DELETE FROM auth.users WHERE id = $1", [adaId]);
    expect(await readExtensions(test)).toEqual([]);
  });
});

describe("billing's foreign keys", () => {
  let test: TestBilling;

  beforeEach(async () => {
    test = await createTestBilling();
  });
  afterEach(() => test.database.close());

  it("each have an index that starts with their column, so a cascading delete does not scan the table", async () => {
    const result = await test.database.client.query<{ table_name: string; column_name: string; is_indexed: boolean }>(`
      SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name,
        EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]) AS is_indexed
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.connamespace = 'billing'::regnamespace
      ORDER BY 1, 2`);
    expect(result.rows.length).toBeGreaterThanOrEqual(9);
    expect(result.rows.filter((row) => !row.is_indexed)).toEqual([]);
  });
});
