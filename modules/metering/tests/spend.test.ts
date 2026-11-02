// The ledger: reservations against budgets, settling and releasing them, charges after the fact and the spend of a period.
import { getSpend, recordCharge, releaseSpend, reserveSpend, settleSpend } from "@softure-ai/metering/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfig, createTestMetering, listRows, NOW, type TestMetering } from "./support.js";

const HOUR_MS = 60 * 60 * 1000;

describe("the spend ledger", () => {
  let test: TestMetering;

  beforeEach(async () => {
    test = await createTestMetering();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("reserves within the budget, then settles the billed amount", async () => {
    const reserved = await reserveSpend(test.ctx, { provider: "speech", amount: 40, step: "transcribe", attributes: { jobId: "j1" } });
    if (!reserved.ok) throw new Error("expected a reservation");
    expect(reserved.value).toEqual({
      id: expect.any(String) as string,
      provider: "speech",
      unit: "seconds",
      amount: 40,
      accountId: null,
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + HOUR_MS),
    });
    expect(await listRows(test.database)).toEqual(["speech reserved 40 - transcribe"]);

    expect(await settleSpend(test.ctx, reserved.value, 35.5)).toEqual({ ok: true, value: undefined });
    expect(await listRows(test.database)).toEqual(["speech settled 35.5 - transcribe"]);
    const row = await test.database.client.query<{ attributes: unknown; expires_at: Date | null; settled_at: Date }>(
      "SELECT attributes, expires_at, settled_at FROM metering.charges",
    );
    expect(row.rows).toEqual([{ attributes: { jobId: "j1" }, expires_at: null, settled_at: NOW }]);
  });

  it("refuses an amount over the remaining budget, naming the budget and what is left", async () => {
    await recordCharge(test.ctx, { provider: "speech", amount: 50 });
    const refused = await reserveSpend(test.ctx, { provider: "speech", amount: 10.5 });
    expect(refused).toEqual({
      ok: false,
      error: "metering.budget_exceeded",
      requested: 10.5,
      budget: {
        provider: "speech",
        unit: "seconds",
        period: "day",
        scope: { kind: "provider" },
        limit: 60,
        spent: 50,
        remaining: 10,
        // Midnight of 16 October in Warsaw (CEST, UTC+2).
        resetsAt: new Date("2026-10-15T22:00:00Z"),
      },
    });
    expect(await listRows(test.database)).toEqual(["speech settled 50 - -"]);
    // Exactly the remaining amount fits.
    expect((await reserveSpend(test.ctx, { provider: "speech", amount: 10 })).ok).toBe(true);
  });

  it("compares decimal amounts exactly: 0.1 and 0.2 fill a 0.3 budget", async () => {
    expect((await reserveSpend(test.ctx, { provider: "openrouter", amount: 0.1 })).ok).toBe(true);
    expect((await reserveSpend(test.ctx, { provider: "openrouter", amount: 0.2 })).ok).toBe(true);
    const refused = await reserveSpend(test.ctx, { provider: "openrouter", amount: 0.00000001 });
    expect(refused.ok ? null : refused.error).toBe("metering.budget_exceeded");
    expect(refused.ok ? null : "budget" in refused ? refused.budget.remaining : null).toBe(0);
  });

  it("checks the per-account and the provider-wide budget together", async () => {
    // elevenlabs: 1000 credits a month for everyone, 100 a day per account.
    expect((await reserveSpend(test.ctx, { provider: "elevenlabs", amount: 100, accountId: "a" })).ok).toBe(true);
    const perAccount = await reserveSpend(test.ctx, { provider: "elevenlabs", amount: 1, accountId: "a" });
    expect(perAccount.ok ? null : "budget" in perAccount ? perAccount.budget.scope : null).toEqual({ kind: "account", accountId: "a" });

    await recordCharge(test.ctx, { provider: "elevenlabs", amount: 850, accountId: "b", at: new Date("2026-10-01T00:00:00Z") });
    const monthly = await reserveSpend(test.ctx, { provider: "elevenlabs", amount: 60, accountId: "c" });
    expect(monthly.ok ? null : "budget" in monthly ? monthly.budget : null).toMatchObject({
      period: "month",
      scope: { kind: "provider" },
      spent: 950,
      remaining: 50,
      resetsAt: new Date("2026-10-31T23:00:00Z"),
    });
    expect((await reserveSpend(test.ctx, { provider: "elevenlabs", amount: 50, accountId: "c" })).ok).toBe(true);
  });

  it("lets only one of two reservations started together take the last of the budget", async () => {
    await recordCharge(test.ctx, { provider: "speech", amount: 30 });
    const results = await Promise.all([
      reserveSpend(test.ctx, { provider: "speech", amount: 20, step: "first" }),
      reserveSpend(test.ctx, { provider: "speech", amount: 20, step: "second" }),
    ]);
    expect(results.map((result) => result.ok).sort()).toEqual([false, true]);
    expect((await getSpend(test.ctx, { provider: "speech", period: "day" })).value.spent).toBe(50);
  });

  it("stops counting a reservation once it expires, without a settle or release", async () => {
    await reserveSpend(test.ctx, { provider: "speech", amount: 60 });
    expect((await reserveSpend(test.ctx, { provider: "speech", amount: 1 })).ok).toBe(false);
    test.clock.advance(HOUR_MS);
    expect((await reserveSpend(test.ctx, { provider: "speech", amount: 1 })).ok).toBe(true);
  });

  it("gives a released reservation's budget back, and refuses to settle or release it twice", async () => {
    const reserved = await reserveSpend(test.ctx, { provider: "speech", amount: 60 });
    if (!reserved.ok) throw new Error("expected a reservation");
    expect(await releaseSpend(test.ctx, reserved.value)).toEqual({ ok: true, value: undefined });
    expect(await listRows(test.database)).toEqual([]);
    expect(await releaseSpend(test.ctx, reserved.value)).toEqual({ ok: false, error: "metering.reservation_not_found" });
    expect(await settleSpend(test.ctx, reserved.value, 1)).toEqual({ ok: false, error: "metering.reservation_not_found" });

    const second = await reserveSpend(test.ctx, { provider: "speech", amount: 5 });
    if (!second.ok) throw new Error("expected a reservation");
    await settleSpend(test.ctx, second.value, 5);
    expect(await settleSpend(test.ctx, second.value, 5)).toEqual({ ok: false, error: "metering.reservation_not_found" });
    expect(await releaseSpend(test.ctx, second.value)).toEqual({ ok: false, error: "metering.reservation_not_found" });
  });

  it("records a settle above the reservation as billed, even past the budget", async () => {
    const reserved = await reserveSpend(test.ctx, { provider: "speech", amount: 50 });
    if (!reserved.ok) throw new Error("expected a reservation");
    await settleSpend(test.ctx, reserved.value, 70);
    expect((await getSpend(test.ctx, { provider: "speech", period: "day" })).value).toMatchObject({ spent: 70, remaining: 0 });
  });

  it("reserves without a lock or a check for a provider with no budget", async () => {
    expect((await reserveSpend(test.ctx, { provider: "search", amount: 1e9 })).ok).toBe(true);
  });

  it("reports a period's settled and reserved spend, with and without a budget", async () => {
    await recordCharge(test.ctx, { provider: "elevenlabs", amount: 12.25, accountId: "a" });
    await recordCharge(test.ctx, { provider: "elevenlabs", amount: 3, accountId: "b" });
    await reserveSpend(test.ctx, { provider: "elevenlabs", amount: 4, accountId: "a" });
    // Yesterday in Warsaw: outside today's period, inside the month.
    await recordCharge(test.ctx, { provider: "elevenlabs", amount: 7, accountId: "a", at: new Date("2026-10-14T21:59:59Z") });

    expect((await getSpend(test.ctx, { provider: "elevenlabs", period: "day", accountId: "a" })).value).toEqual({
      provider: "elevenlabs",
      unit: "credits",
      period: "day",
      accountId: "a",
      from: new Date("2026-10-14T22:00:00Z"),
      resetsAt: new Date("2026-10-15T22:00:00Z"),
      settled: 12.25,
      reserved: 4,
      spent: 16.25,
      limit: 100,
      remaining: 83.75,
    });
    expect((await getSpend(test.ctx, { provider: "elevenlabs", period: "month" })).value).toMatchObject({
      from: new Date("2026-09-30T22:00:00Z"),
      settled: 22.25,
      reserved: 4,
      spent: 26.25,
      limit: 1000,
      remaining: 973.75,
    });
    expect((await getSpend(test.ctx, { provider: "elevenlabs", period: "day" })).value).toMatchObject({ spent: 19.25, limit: null, remaining: null });
  });

  it("starts the day and the month at midnight in the app's time zone", async () => {
    const utc = await createTestMetering(createConfig(undefined, [], "UTC"));
    try {
      utc.clock.set(new Date("2026-10-31T23:30:00Z"));
      expect((await getSpend(utc.ctx, { provider: "speech", period: "day" })).value).toMatchObject({
        from: new Date("2026-10-31T00:00:00Z"),
        resetsAt: new Date("2026-11-01T00:00:00Z"),
      });
      // 00:30 on 1 November in Warsaw (CET after the change of 25 October).
      test.clock.set(new Date("2026-10-31T23:30:00Z"));
      expect((await getSpend(test.ctx, { provider: "speech", period: "month" })).value).toMatchObject({
        from: new Date("2026-10-31T23:00:00Z"),
        resetsAt: new Date("2026-11-30T23:00:00Z"),
      });
    } finally {
      await utc.database.close();
    }
  });

  it("throws for an undeclared provider, an invalid amount and a per-account budget without an account", async () => {
    await expect(reserveSpend(test.ctx, { provider: "unknown", amount: 1 })).rejects.toThrow(
      '@softure-ai/metering: provider "unknown" is not declared; add it to metering({ providers }) in softure.config.ts',
    );
    await expect(recordCharge(test.ctx, { provider: "speech", amount: -1 })).rejects.toThrow(
      "recordCharge: amount must be a finite number from 0 to 1000000000000000, got -1",
    );
    await expect(reserveSpend(test.ctx, { provider: "speech", amount: Number.NaN })).rejects.toThrow("got NaN");
    await expect(reserveSpend(test.ctx, { provider: "elevenlabs", amount: 1 })).rejects.toThrow(
      'reserveSpend: provider "elevenlabs" has a per-account budget, so every reservation names its accountId',
    );
    await expect(reserveSpend(test.ctx, { provider: "speech", amount: 1, step: "" })).rejects.toThrow('step of provider "speech" must be 1 to 100 characters');
    expect(await listRows(test.database)).toEqual([]);
  });
});

