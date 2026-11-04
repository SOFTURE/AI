// GDPR: a user's charges are exported, and a deletion anonymises them and keeps the spend totals.
import { deleteMeteringUserData, exportMeteringUserData, getBudgetLimits, getSpend, meteringPrivacyContributor, recordCharge, setBudgetLimit } from "@softure-ai/metering/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestMetering, listRows, NOW, type TestMetering } from "./support.js";

describe("metering privacy", () => {
  let test: TestMetering;

  beforeEach(async () => {
    test = await createTestMetering();
    await recordCharge(test.ctx, { provider: "speech", amount: 5, step: "transcribe", accountId: "user-1", attributes: { jobId: "j1" } });
    await recordCharge(test.ctx, { provider: "speech", amount: 7, accountId: "user-2" });
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("exports the charges that name the user", async () => {
    expect(await exportMeteringUserData(test.ctx, "user-1")).toEqual({
      ok: true,
      value: {
        charges: [{ provider: "speech", step: "transcribe", unit: "seconds", amount: 5, status: "settled", attributes: { jobId: "j1" }, createdAt: NOW }],
        budgetLimits: [],
      },
    });
    expect(await exportMeteringUserData(test.ctx, "nobody")).toEqual({ ok: true, value: { charges: [], budgetLimits: [] } });
  });

  it("clears the user from their charges and keeps the amounts in the totals", async () => {
    expect(await deleteMeteringUserData(test.ctx, "user-1")).toEqual({ ok: true, value: { anonymizedCharges: 1, anonymizedBudgetLimits: 0 } });
    expect(await listRows(test.database)).toEqual(["speech settled 5 - transcribe", "speech settled 7 user-2 -"]);
    const attributes = await test.database.client.query<{ attributes: unknown }>("SELECT attributes FROM metering.charges WHERE account_id IS NULL");
    expect(attributes.rows).toEqual([{ attributes: {} }]);
    expect((await getSpend(test.ctx, { provider: "speech", period: "day" })).value.spent).toBe(12);
    expect(await meteringPrivacyContributor.deleteUserData?.(test.ctx, "user-2")).toEqual({ ok: true, value: undefined });
  });

  it("exports the budget limits the user set, and a deletion clears their name but keeps the limit", async () => {
    await setBudgetLimit(test.ctx, { provider: "speech", period: "day", limit: 30, updatedBy: "user-1" });
    await setBudgetLimit(test.ctx, { provider: "elevenlabs", period: "month", limit: 500, updatedBy: "user-2" });
    expect((await exportMeteringUserData(test.ctx, "user-1")).value.budgetLimits).toEqual([
      { provider: "speech", period: "day", perAccount: false, limit: 30, updatedAt: NOW },
    ]);

    expect(await deleteMeteringUserData(test.ctx, "user-1")).toEqual({ ok: true, value: { anonymizedCharges: 1, anonymizedBudgetLimits: 1 } });
    expect((await getBudgetLimits(test.ctx, { provider: "speech" })).value).toEqual([
      { provider: "speech", unit: "seconds", period: "day", perAccount: false, configuredLimit: 60, storedLimit: 30, limit: 30, updatedAt: NOW, updatedBy: null },
    ]);
    expect((await exportMeteringUserData(test.ctx, "user-1")).value.budgetLimits).toEqual([]);
    expect((await exportMeteringUserData(test.ctx, "user-2")).value.budgetLimits).toHaveLength(1);
  });
});
