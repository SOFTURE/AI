// Budget limits changed at runtime: stored, listed, cleared, and applied by reservations and spend summaries.
import { clearBudgetLimit, getBudgetLimits, getSpend, recordCharge, reserveSpend, setBudgetLimit } from "@softure-ai/metering/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestMetering, NOW, type TestMetering } from "./support.js";

const LATER = new Date(NOW.getTime() + 60 * 1000);

describe("runtime budget limits", () => {
  let test: TestMetering;

  beforeEach(async () => {
    test = await createTestMetering();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("refuses a reservation over a lower stored limit with that limit, and clearing it restores the configured one", async () => {
    // speech: 60 seconds a day in the configuration.
    expect((await reserveSpend(test.ctx, { provider: "speech", amount: 20 })).ok).toBe(true);

    expect(await setBudgetLimit(test.ctx, { provider: "speech", period: "day", limit: 25, updatedBy: "admin-1" })).toEqual({
      ok: true,
      value: { provider: "speech", unit: "seconds", period: "day", perAccount: false, configuredLimit: 60, storedLimit: 25, limit: 25, updatedAt: NOW, updatedBy: "admin-1" },
    });
    const refused = await reserveSpend(test.ctx, { provider: "speech", amount: 10 });
    expect(refused).toEqual({
      ok: false,
      error: "metering.budget_exceeded",
      requested: 10,
      budget: {
        provider: "speech",
        unit: "seconds",
        period: "day",
        scope: { kind: "provider" },
        limit: 25,
        spent: 20,
        remaining: 5,
        resetsAt: new Date("2026-10-15T22:00:00Z"),
      },
    });

    expect(await clearBudgetLimit(test.ctx, { provider: "speech", period: "day" })).toEqual({
      ok: true,
      value: { provider: "speech", unit: "seconds", period: "day", perAccount: false, configuredLimit: 60, storedLimit: null, limit: 60, updatedAt: null, updatedBy: null },
    });
    expect((await reserveSpend(test.ctx, { provider: "speech", amount: 10 })).ok).toBe(true);
  });

  it("reports the stored limit and its remaining amount in getSpend", async () => {
    await recordCharge(test.ctx, { provider: "speech", amount: 12 });
    await setBudgetLimit(test.ctx, { provider: "speech", period: "day", limit: 40.5 });
    const spend = await getSpend(test.ctx, { provider: "speech", period: "day" });
    expect(spend.value).toMatchObject({ spent: 12, limit: 40.5, remaining: 28.5 });
    // A filter keeps the scope's effective budget.
    expect((await getSpend(test.ctx, { provider: "speech", period: "day", filter: { attribute: "jobId", value: "j1" } })).value).toMatchObject({ spent: 0, limit: 40.5, remaining: 40.5 });
    // A provider without a budget still has none.
    expect((await getSpend(test.ctx, { provider: "search", period: "day" })).value).toMatchObject({ limit: null, remaining: null });
  });

  it("raises a limit above the configured one, and a stored 0 stops the provider", async () => {
    await recordCharge(test.ctx, { provider: "speech", amount: 60 });
    expect((await reserveSpend(test.ctx, { provider: "speech", amount: 1 })).ok).toBe(false);
    await setBudgetLimit(test.ctx, { provider: "speech", period: "day", limit: 90 });
    expect((await reserveSpend(test.ctx, { provider: "speech", amount: 30 })).ok).toBe(true);

    await setBudgetLimit(test.ctx, { provider: "openrouter", period: "day", limit: 0 });
    const stopped = await reserveSpend(test.ctx, { provider: "openrouter", amount: 0.01 });
    expect(stopped.ok ? null : "budget" in stopped ? stopped.budget : null).toMatchObject({ limit: 0, spent: 0, remaining: 0 });
    // An amount of 0 still fits.
    expect((await reserveSpend(test.ctx, { provider: "openrouter", amount: 0 })).ok).toBe(true);
  });

  it("overrides only the budget it names: a per-account limit leaves the provider's month untouched", async () => {
    // elevenlabs: 1000 credits a month, 100 a day per account.
    await setBudgetLimit(test.ctx, { provider: "elevenlabs", period: "day", perAccount: true, limit: 10 });
    const refused = await reserveSpend(test.ctx, { provider: "elevenlabs", amount: 11, accountId: "a" });
    expect(refused.ok ? null : "budget" in refused ? refused.budget : null).toMatchObject({ scope: { kind: "account", accountId: "a" }, limit: 10 });
    expect((await getSpend(test.ctx, { provider: "elevenlabs", period: "day", accountId: "a" })).value.limit).toBe(10);
    expect((await getSpend(test.ctx, { provider: "elevenlabs", period: "month" })).value.limit).toBe(1000);
  });

  it("lists every declared budget in configuration order with its default, stored value and author", async () => {
    test.clock.set(LATER);
    await setBudgetLimit(test.ctx, { provider: "elevenlabs", period: "day", perAccount: true, limit: 50, updatedBy: "admin-1" });
    expect(await getBudgetLimits(test.ctx, { provider: "elevenlabs" })).toEqual({
      ok: true,
      value: [
        { provider: "elevenlabs", unit: "credits", period: "month", perAccount: false, configuredLimit: 1000, storedLimit: null, limit: 1000, updatedAt: null, updatedBy: null },
        { provider: "elevenlabs", unit: "credits", period: "day", perAccount: true, configuredLimit: 100, storedLimit: 50, limit: 50, updatedAt: LATER, updatedBy: "admin-1" },
      ],
    });
    expect(await getBudgetLimits(test.ctx, { provider: "search" })).toEqual({ ok: true, value: [] });
  });

  it("replaces a stored limit and its author, and keeps 8 decimal places", async () => {
    await setBudgetLimit(test.ctx, { provider: "openrouter", period: "day", limit: 1, updatedBy: "admin-1" });
    const replaced = await setBudgetLimit(test.ctx, { provider: "openrouter", period: "day", limit: 0.123456789 });
    expect(replaced.ok ? replaced.value : null).toMatchObject({ storedLimit: 0.12345679, limit: 0.12345679, updatedBy: null });
    const rows = await test.database.client.query<{ count: string }>("SELECT count(*)::text AS count FROM metering.budget_limits");
    expect(rows.rows).toEqual([{ count: "1" }]);
  });

  it("returns an invalid limit as an error and stores nothing", async () => {
    for (const limit of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1e16]) {
      expect(await setBudgetLimit(test.ctx, { provider: "speech", period: "day", limit })).toEqual({ ok: false, error: "metering.invalid_budget_limit" });
    }
    expect((await getBudgetLimits(test.ctx, { provider: "speech" })).value[0]?.storedLimit).toBeNull();
  });

  it("throws for a budget or provider the configuration does not declare, and an empty author", async () => {
    await expect(setBudgetLimit(test.ctx, { provider: "speech", period: "month", limit: 5 })).rejects.toThrow(
      'setBudgetLimit: provider "speech" declares no month budget for the whole provider; add it to metering({ providers }) in softure.config.ts',
    );
    await expect(clearBudgetLimit(test.ctx, { provider: "speech", period: "day", perAccount: true })).rejects.toThrow(
      'clearBudgetLimit: provider "speech" declares no day budget per account',
    );
    await expect(getBudgetLimits(test.ctx, { provider: "nope" })).rejects.toThrow('provider "nope" is not declared');
    await expect(setBudgetLimit(test.ctx, { provider: "speech", period: "day", limit: 5, updatedBy: "" })).rejects.toThrow(
      "setBudgetLimit: updatedBy must be 1 to 200 characters",
    );
  });
});
