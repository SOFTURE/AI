// Billing's locks on a real Postgres (tests/postgres.ts): changes that overlap in time, on separate
// connections, where PGlite's single connection would run them one after the other. A blocker
// connection holds the contested lock until both changes wait on it, so the interleaving is the
// same on every run: the race happens, it is not hoped for.
import { type BillingOptionsInput } from "@softure-ai/billing";
import { changeEntitlement, extendTrialManually, getEntitlement, grantPlan, grantPlanManually, recordPaymentRequest } from "@softure-ai/billing/server";
import { err } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresBilling, isPostgresRequired, openBlocker, POSTGRES_ADMIN_URL, waitForLockWaiters, type Blocker, type PostgresBilling } from "./postgres.js";
import { createAccount, NOW } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime" },
];
/** The end of a 14-day trial begun at NOW, and one, two and three months on top. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");
const TWO_MONTHS_AFTER_TRIAL = new Date("2026-12-16T23:00:00Z");
const THREE_MONTHS_AFTER_TRIAL = new Date("2027-01-16T23:00:00Z");

describe("the Postgres server for billing's lock tests", () => {
  it.runIf(isPostgresRequired)("is configured in CI", () => {
    expect(POSTGRES_ADMIN_URL).toMatch(/^postgres(ql)?:\/\//);
  });
});

describe.skipIf(POSTGRES_ADMIN_URL === undefined)("billing locks on two connections", () => {
  let test: PostgresBilling;
  let adaId: string;
  let blocker: Blocker | undefined;

  beforeEach(async () => {
    test = await createPostgresBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(async () => {
    await blocker?.release();
    blocker = undefined;
    await test.close();
  });

  async function readStoredRow(): Promise<{ trial_ends_at: Date; paid_until: Date | null; is_lifetime: boolean }[]> {
    const result = await test.handle.pool.query<{ trial_ends_at: Date; paid_until: Date | null; is_lifetime: boolean }>(
      "SELECT trial_ends_at, paid_until, is_lifetime FROM billing.entitlements WHERE user_id = $1",
      [adaId],
    );
    return result.rows;
  }

  it("applies both first changes of a new account when another change inserts its row first", async () => {
    // The blocker plays the change that inserts first: its row is not visible to the two changes,
    // so both take the insert branch and wait on its key, then find the row and apply on top.
    blocker = await openBlocker(test);
    await blocker.query(
      "INSERT INTO billing.entitlements (user_id, trial_ends_at, paid_until, is_lifetime, created_at, updated_at) VALUES ($1, $2, NULL, false, $3, $3)",
      [adaId, TRIAL_END, NOW],
    );
    const changes = Promise.all([grantPlan(test.ctx, adaId, "monthly"), grantPlan(test.ctx, adaId, "monthly")]);
    await waitForLockWaiters(test, 2);
    await blocker.release();

    const [first, second] = await changes;
    expect(first.ok && second.ok).toBe(true);
    expect(await readStoredRow()).toEqual([{ trial_ends_at: TRIAL_END, paid_until: TWO_MONTHS_AFTER_TRIAL, is_lifetime: false }]);
  });

  it("keeps one row and both changes when two first changes race", async () => {
    const [first, second] = await Promise.all([
      changeEntitlement(test.ctx, adaId, { type: "grant", until: MONTH_AFTER_TRIAL }),
      changeEntitlement(test.ctx, adaId, { type: "extend_trial", until: new Date("2026-10-23T22:00:00Z") }),
    ]);
    expect(first.ok && second.ok).toBe(true);
    expect(await readStoredRow()).toEqual([{ trial_ends_at: new Date("2026-10-23T22:00:00Z"), paid_until: MONTH_AFTER_TRIAL, is_lifetime: false }]);
  });

  it("adds a period for each of two plan grants made at once", async () => {
    await grantPlan(test.ctx, adaId, "monthly");
    blocker = await openBlocker(test);
    await blocker.query("SELECT 1 FROM billing.entitlements WHERE user_id = $1 FOR UPDATE", [adaId]);
    const grants = Promise.all([
      grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null }),
      grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null }),
    ]);
    await waitForLockWaiters(test, 2);
    await blocker.release();

    const [first, second] = await grants;
    expect(first.ok && second.ok).toBe(true);
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: THREE_MONTHS_AFTER_TRIAL });
    // Each grant recorded the month it added, one after the other.
    const periods = await test.handle.pool.query<{ granted_from: Date; granted_until: Date }>(
      "SELECT granted_from, granted_until FROM billing.manual_grants WHERE user_id = $1 ORDER BY granted_from",
      [adaId],
    );
    expect(periods.rows).toEqual([
      { granted_from: MONTH_AFTER_TRIAL, granted_until: TWO_MONTHS_AFTER_TRIAL },
      { granted_from: TWO_MONTHS_AFTER_TRIAL, granted_until: THREE_MONTHS_AFTER_TRIAL },
    ]);
  });

  it("keeps both a plan grant and a trial extension made at once on an account without a row", async () => {
    // The blocker plays a change that inserts the account's first row: both start before it exists.
    blocker = await openBlocker(test);
    await blocker.query(
      "INSERT INTO billing.entitlements (user_id, trial_ends_at, paid_until, is_lifetime, created_at, updated_at) VALUES ($1, $2, NULL, false, $3, $3)",
      [adaId, TRIAL_END, NOW],
    );
    const extendedEnd = new Date("2026-10-23T22:00:00Z");
    const changes = Promise.all([
      grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null }),
      extendTrialManually(test.ctx, { userId: adaId, until: extendedEnd, adminId: null }),
    ]);
    await waitForLockWaiters(test, 2);
    await blocker.release();

    const [grant, extension] = await changes;
    expect(grant.ok && extension.ok).toBe(true);
    const row = (await readStoredRow())[0];
    expect(row?.trial_ends_at).toEqual(extendedEnd);
    // The month starts where access ended when the grant ran: the old or the extended trial end.
    expect([MONTH_AFTER_TRIAL.getTime(), new Date("2026-11-23T23:00:00Z").getTime()]).toContain(row?.paid_until?.getTime());
    const extensions = await test.handle.pool.query<{ previous_ends_at: Date; ends_at: Date }>("SELECT previous_ends_at, ends_at FROM billing.trial_extensions WHERE user_id = $1", [adaId]);
    expect(extensions.rows).toEqual([{ previous_ends_at: TRIAL_END, ends_at: extendedEnd }]);
  });

  async function readManualGrantKinds(): Promise<string[]> {
    const result = await test.handle.pool.query<{ grant_kind: string }>(
      "SELECT grant_kind FROM billing.manual_grants WHERE user_id = $1 AND status = 'active' ORDER BY granted_at",
      [adaId],
    );
    return result.rows.map((row) => row.grant_kind);
  }

  it("refuses the second of two lifetime grants made at once on an account without a row", async () => {
    // The blocker plays a change that inserts the account's first row: both grants start before
    // the row exists and must still see each other's lifetime.
    blocker = await openBlocker(test);
    await blocker.query(
      "INSERT INTO billing.entitlements (user_id, trial_ends_at, paid_until, is_lifetime, created_at, updated_at) VALUES ($1, $2, NULL, false, $3, $3)",
      [adaId, TRIAL_END, NOW],
    );
    const grants = Promise.all([
      grantPlanManually(test.ctx, { userId: adaId, planId: "lifetime", adminId: null }),
      grantPlanManually(test.ctx, { userId: adaId, planId: "lifetime", adminId: null }),
    ]);
    await waitForLockWaiters(test, 2);
    await blocker.release();

    const results = await grants;
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([err("billing.lifetime_active")]);
    expect(await readManualGrantKinds()).toEqual(["lifetime"]);
    expect(await readStoredRow()).toEqual([{ trial_ends_at: TRIAL_END, paid_until: null, is_lifetime: true }]);
  });

  it("refuses a period grant made while a lifetime grant is still open on an account without a row", async () => {
    const requestId = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "lifetime", invoice: null, price: { amount: 49900, currency: "PLN" } });
    // The blocker holds the lifetime grant at its request, after it took the account's entitlement.
    blocker = await openBlocker(test);
    await blocker.query("SELECT 1 FROM billing.payment_requests WHERE id = $1 FOR UPDATE", [requestId]);
    const lifetime = grantPlanManually(test.ctx, { userId: adaId, planId: "lifetime", adminId: null, requestId });
    await waitForLockWaiters(test, 1);
    // The period grant must wait for the lifetime grant, not slip in before its row exists.
    const period = grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null });
    await waitForLockWaiters(test, 2);
    await blocker.release();

    expect((await lifetime).ok).toBe(true);
    expect(await period).toEqual(err("billing.lifetime_active"));
    expect(await readManualGrantKinds()).toEqual(["lifetime"]);
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: null });
  });
});
