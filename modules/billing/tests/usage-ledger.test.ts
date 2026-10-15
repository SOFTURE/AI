// The usage ledger on PGlite: consuming quota per account, meter and calendar month, the refusal
// once the limit is used up, limits that follow the account's state and plan, and a consumption that
// rolls back with the app's own transaction.
import { type BillingOptionsInput } from "@softure-ai/billing";
import { consumeUsage, getUsage, grantPlanManually } from "@softure-ai/billing/server";
import { err, ok } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, type TestBilling } from "./support.js";

const OPTIONS: BillingOptionsInput = {
  trial: { limits: { "ai-calls": 3 } },
  paid: { limits: { "ai-calls": 100, exports: null } },
  plans: [{ id: "pro", name: { en: "Pro" }, price: { amount: 4900, currency: "PLN" }, period: "month", limits: { "ai-calls": 1000 } }],
};
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
/** October and November in Warsaw: from the start of the 1st, local time. */
const OCTOBER = new Date("2026-09-30T22:00:00Z");
const NOVEMBER = new Date("2026-10-31T23:00:00Z");
const DECEMBER = new Date("2026-11-30T23:00:00Z");
/** The end of a 14-day trial begun at NOW. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");

function aiCalls(used: number, limit: number | null, periodStart = OCTOBER, resetsAt = NOVEMBER) {
  return { meter: "ai-calls", period: "month", used, limit, remaining: limit === null ? null : Math.max(0, limit - used), periodStart, resetsAt };
}

describe("consumeUsage", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling(OPTIONS);
    adaId = await createAccount(test, "ada@example.com");
  });

  afterEach(async () => {
    await test.database.close();
  });

  it("counts consumptions until the limit and refuses the one that would pass it, consuming nothing", async () => {
    expect(await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toEqual(ok(aiCalls(1, 3)));
    expect(await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls", amount: 2 })).toEqual(ok(aiCalls(3, 3)));
    expect(await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toEqual({ ...err("billing.quota_exhausted"), usage: aiCalls(3, 3) });
    expect(await getUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toEqual(ok(aiCalls(3, 3)));
  });

  it("refuses an amount larger than what is left, and a first one larger than the limit", async () => {
    await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls", amount: 2 });
    expect(await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls", amount: 2 })).toEqual({ ...err("billing.quota_exhausted"), usage: aiCalls(2, 3) });
    const eveId = await createAccount(test, "eve@example.com");
    expect(await consumeUsage(test.ctx, { userId: eveId, meter: "ai-calls", amount: 4 })).toEqual({ ...err("billing.quota_exhausted"), usage: aiCalls(0, 3) });
    expect(await test.database.client.query("SELECT 1 FROM billing.usage WHERE user_id = $1", [eveId])).toMatchObject({ rows: [] });
  });

  it("refuses a meter the account's state leaves at 0", async () => {
    expect(await consumeUsage(test.ctx, { userId: adaId, meter: "exports" })).toMatchObject({ ok: false, error: "billing.quota_exhausted", usage: { used: 0, limit: 0, remaining: 0 } });
  });

  it("starts again from 0 in the next local month", async () => {
    await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls", amount: 3 });
    // Paid, so the account still writes in November; the count is per month whatever the state.
    await grantPlanManually(test.ctx, { userId: adaId, planId: "pro", adminId: null });
    test.clock.set(new Date(NOVEMBER.getTime() - 1));
    expect(await getUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toEqual(ok(aiCalls(3, 1000)));
    test.clock.set(NOVEMBER);
    expect(await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toEqual(ok(aiCalls(1, 1000, NOVEMBER, DECEMBER)));
  });

  it("follows the account's state and plan: a plan raises the limit, a meter with null has none", async () => {
    await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls", amount: 3 });
    await grantPlanManually(test.ctx, { userId: adaId, planId: "pro", adminId: null });
    expect(await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls", amount: 997 })).toEqual(ok(aiCalls(1000, 1000)));
    expect(await consumeUsage(test.ctx, { userId: adaId, meter: "exports", amount: 1_000_000 })).toMatchObject({ ok: true, value: { used: 1_000_000, limit: null, remaining: null } });
  });

  it("keeps what was used when the limit drops, refusing until the next month", async () => {
    await grantPlanManually(test.ctx, { userId: adaId, planId: "pro", adminId: null });
    await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls", amount: 5 });
    const eveId = await createAccount(test, "eve@example.com");
    test.clock.set(TRIAL_END);
    // Eve's trial ended (read-only: no limits block, so 0); ada's 5 stay above a trial's 3 had she one.
    expect(await consumeUsage(test.ctx, { userId: eveId, meter: "ai-calls" })).toMatchObject({ ok: false, error: "billing.quota_exhausted", usage: { limit: 0 } });
    expect(await getUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toEqual(ok(aiCalls(5, 1000)));
  });

  it("rolls back with the app's transaction", async () => {
    const failure = new Error("the app's write failed");
    await expect(
      test.ctx.db.transaction(async (tx) => {
        const consumed = await consumeUsage({ ...test.ctx, db: tx }, { userId: adaId, meter: "ai-calls" });
        expect(consumed.ok).toBe(true);
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(await getUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toEqual(ok(aiCalls(0, 3)));
  });

  it("answers billing.account_unknown without an account", async () => {
    expect(await consumeUsage(test.ctx, { userId: UNKNOWN_ID, meter: "ai-calls" })).toEqual(err("billing.account_unknown"));
    expect(await consumeUsage(test.ctx, { userId: "not-a-uuid", meter: "ai-calls" })).toEqual(err("billing.account_unknown"));
    expect(await getUsage(test.ctx, { userId: UNKNOWN_ID, meter: "ai-calls" })).toEqual(err("billing.account_unknown"));
  });

  it("throws for a meter the config does not declare and for an amount that is not a whole number from 1", async () => {
    await expect(consumeUsage(test.ctx, { userId: adaId, meter: "uploads" })).rejects.toThrow('the meter "uploads" is in no limits block');
    await expect(getUsage(test.ctx, { userId: adaId, meter: "uploads" })).rejects.toThrow('the meter "uploads" is in no limits block');
    for (const amount of [0, -1, 1.5, Number.NaN, 1_000_000_001]) {
      await expect(consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls", amount }), String(amount)).rejects.toThrow("amount must be a whole number");
    }
  });

  it("stamps the row with the consumption's instant", async () => {
    await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls" });
    const later = new Date(NOW.getTime() + 60_000);
    test.clock.set(later);
    await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls" });
    const rows = await test.database.client.query<{ period: string; period_start: Date; used: number; updated_at: Date }>(
      "SELECT period, period_start, used::int AS used, updated_at FROM billing.usage WHERE user_id = $1",
      [adaId],
    );
    expect(rows.rows).toEqual([{ period: "month", period_start: OCTOBER, used: 2, updated_at: later }]);
  });
});
