// Spend per step or per attribute value, and one item's spend through an attribute filter.
import { getSpend, getSpendBreakdown, recordCharge, reserveSpend } from "@softure-ai/metering/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestMetering, NOW, type TestMetering } from "./support.js";

const HOUR_MS = 60 * 60 * 1000;

describe("the spend breakdown", () => {
  let test: TestMetering;

  beforeEach(async () => {
    test = await createTestMetering();
    // search: requests, no budget. Two items, two steps, one charge without either.
    await recordCharge(test.ctx, { provider: "search", amount: 3, step: "isolate", attributes: { jobId: "j1" } });
    await recordCharge(test.ctx, { provider: "search", amount: 2, step: "transcribe", attributes: { jobId: "j1" } });
    await recordCharge(test.ctx, { provider: "search", amount: 4, step: "isolate", accountId: "a", attributes: { jobId: "j2", filmId: "f1" } });
    await recordCharge(test.ctx, { provider: "search", amount: 1.5 });
    await reserveSpend(test.ctx, { provider: "search", amount: 0.25, step: "transcribe", attributes: { jobId: "j2" } });
    // Not counted: last month, another provider.
    await recordCharge(test.ctx, { provider: "search", amount: 100, step: "isolate", attributes: { jobId: "j1" }, at: new Date("2026-09-30T12:00:00Z") });
    await recordCharge(test.ctx, { provider: "speech", amount: 50, step: "isolate", attributes: { jobId: "j1" } });
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("groups the month's spend by step, with the charges without a step last", async () => {
    const breakdown = await getSpendBreakdown(test.ctx, { provider: "search", period: "month", groupBy: "step" });
    expect(breakdown).toEqual({
      ok: true,
      value: {
        provider: "search",
        unit: "requests",
        period: "month",
        accountId: null,
        groupBy: "step",
        filter: null,
        // 1 October to 1 November in Warsaw (CEST then CET).
        from: new Date("2026-09-30T22:00:00Z"),
        resetsAt: new Date("2026-10-31T23:00:00Z"),
        rows: [
          { key: "isolate", settled: 7, reserved: 0, spent: 7 },
          { key: "transcribe", settled: 2, reserved: 0.25, spent: 2.25 },
          { key: null, settled: 1.5, reserved: 0, spent: 1.5 },
        ],
      },
    });
  });

  it("groups by an attribute, and the rows add up to getSpend", async () => {
    const breakdown = await getSpendBreakdown(test.ctx, { provider: "search", period: "month", groupBy: { attribute: "jobId" } });
    if (!breakdown.ok) throw new Error("expected a breakdown");
    expect(breakdown.value.rows).toEqual([
      { key: "j1", settled: 5, reserved: 0, spent: 5 },
      { key: "j2", settled: 4, reserved: 0.25, spent: 4.25 },
      { key: null, settled: 1.5, reserved: 0, spent: 1.5 },
    ]);
    const total = await getSpend(test.ctx, { provider: "search", period: "month" });
    if (!total.ok) throw new Error("expected a summary");
    expect(breakdown.value.rows.reduce((sum, row) => sum + row.spent, 0)).toBe(total.value.spent);
  });

  it("orders rows by spend, then by key", async () => {
    const breakdown = await getSpendBreakdown(test.ctx, { provider: "search", period: "month", groupBy: { attribute: "filmId" } });
    expect(breakdown.ok ? breakdown.value.rows.map((row) => row.key) : null).toEqual([null, "f1"]);
    await recordCharge(test.ctx, { provider: "search", amount: 4, attributes: { filmId: "f0" } });
    const tied = await getSpendBreakdown(test.ctx, { provider: "search", period: "month", groupBy: { attribute: "filmId" } });
    expect(tied.ok ? tied.value.rows.map((row) => row.key) : null).toEqual([null, "f0", "f1"]);
  });

  it("narrows a breakdown to one item and one account", async () => {
    const item = await getSpendBreakdown(test.ctx, { provider: "search", period: "month", groupBy: "step", filter: { attribute: "jobId", value: "j2" } });
    expect(item.ok ? { filter: item.value.filter, rows: item.value.rows } : null).toEqual({
      filter: { attribute: "jobId", value: "j2" },
      rows: [
        { key: "isolate", settled: 4, reserved: 0, spent: 4 },
        { key: "transcribe", settled: 0, reserved: 0.25, spent: 0.25 },
      ],
    });
    const account = await getSpendBreakdown(test.ctx, { provider: "search", period: "month", accountId: "a", groupBy: "step" });
    expect(account.ok ? { accountId: account.value.accountId, rows: account.value.rows } : null).toEqual({
      accountId: "a",
      rows: [{ key: "isolate", settled: 4, reserved: 0, spent: 4 }],
    });
  });

  it("leaves expired reservations out", async () => {
    test.clock.set(new Date(NOW.getTime() + 2 * HOUR_MS));
    const breakdown = await getSpendBreakdown(test.ctx, { provider: "search", period: "month", groupBy: "step" });
    expect(breakdown.ok ? breakdown.value.rows.find((row) => row.key === "transcribe") : null).toEqual({ key: "transcribe", settled: 2, reserved: 0, spent: 2 });
  });

  it("answers no rows for a period without spend", async () => {
    test.clock.set(new Date("2026-12-15T12:00:00Z"));
    const breakdown = await getSpendBreakdown(test.ctx, { provider: "search", period: "day", groupBy: "step" });
    expect(breakdown.ok ? breakdown.value.rows : null).toEqual([]);
  });

  it("gives one item's total through getSpend's filter, keeping the scope's budget", async () => {
    await recordCharge(test.ctx, { provider: "speech", amount: 5, attributes: { jobId: "j2" } });
    const item = await getSpend(test.ctx, { provider: "speech", period: "day", filter: { attribute: "jobId", value: "j1" } });
    expect(item.ok ? item.value : null).toMatchObject({ settled: 50, reserved: 0, spent: 50, limit: 60, remaining: 10 });
    const none = await getSpend(test.ctx, { provider: "search", period: "month", filter: { attribute: "jobId", value: "missing" } });
    expect(none.ok ? none.value : null).toMatchObject({ settled: 0, reserved: 0, spent: 0, limit: null, remaining: null });
    const reserved = await getSpend(test.ctx, { provider: "search", period: "month", filter: { attribute: "jobId", value: "j2" } });
    expect(reserved.ok ? reserved.value : null).toMatchObject({ settled: 4, reserved: 0.25, spent: 4.25 });
  });

  it("matches an attribute value exactly, quotes and all", async () => {
    await recordCharge(test.ctx, { provider: "search", amount: 8, attributes: { "job\"Id": "x'); drop table metering.charges; --" } });
    const odd = await getSpend(test.ctx, { provider: "search", period: "month", filter: { attribute: "job\"Id", value: "x'); drop table metering.charges; --" } });
    expect(odd.ok ? odd.value.spent : null).toBe(8);
    const prefix = await getSpend(test.ctx, { provider: "search", period: "month", filter: { attribute: "jobId", value: "j" } });
    expect(prefix.ok ? prefix.value.spent : null).toBe(0);
  });

  it("throws for an empty or too long attribute name or value", async () => {
    await expect(getSpendBreakdown(test.ctx, { provider: "search", period: "month", groupBy: { attribute: "" } })).rejects.toThrow(
      "getSpendBreakdown: attribute must be 1 to 100 characters",
    );
    await expect(getSpend(test.ctx, { provider: "search", period: "month", filter: { attribute: "jobId", value: "" } })).rejects.toThrow(
      'getSpend: the value of attribute "jobId" must be 1 to 500 characters',
    );
    await expect(getSpend(test.ctx, { provider: "search", period: "month", filter: { attribute: "a".repeat(101), value: "1" } })).rejects.toThrow(
      "getSpend: attribute must be 1 to 100 characters",
    );
  });

  it("serves an attribute filter from the attributes index", async () => {
    await test.database.client.query("SET enable_seqscan = off");
    const plan = await test.database.client.query<{ "QUERY PLAN": string }>(
      `EXPLAIN SELECT sum(amount) FROM metering.charges WHERE attributes @> jsonb_build_object('jobId'::text, 'j1'::text)`,
    );
    expect(plan.rows.map((row) => row["QUERY PLAN"]).join("\n")).toContain("charges_attributes_idx");
  });
});
