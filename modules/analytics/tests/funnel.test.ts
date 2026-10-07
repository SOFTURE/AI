// The funnel counter on a real Postgres (PGlite): daily sums per channel and step, the cap on new
// channels, the day in the app's time zone, the report and the cleanup.
import { OVERFLOW_CHANNEL } from "@softure-ai/analytics";
import { formatDay, getFunnelReport, pruneFunnelCounts, recordFunnelStep } from "@softure-ai/analytics/server";
import { afterEach, describe, expect, it } from "vitest";
import { createConfig, createTestFunnel, listCounts, type TestFunnel } from "./support.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

let funnel: TestFunnel | undefined;

afterEach(async () => {
  await funnel?.database.close();
  funnel = undefined;
});

async function setUp(...args: Parameters<typeof createTestFunnel>): Promise<TestFunnel> {
  funnel = await createTestFunnel(...args);
  return funnel;
}

describe("recordFunnelStep", () => {
  it("adds visits to one counter per day, channel and step, with no channel as ''", async () => {
    const test = await setUp();
    await recordFunnelStep(test.ctx, { step: "landing", channel: "newsletter" });
    await recordFunnelStep(test.ctx, { step: "landing", channel: "newsletter" });
    await recordFunnelStep(test.ctx, { step: "landing", channel: null });
    await recordFunnelStep(test.ctx, { step: "signup", channel: "newsletter" });

    expect(await listCounts(test)).toEqual([
      { day: "2026-10-03", channel: "", step: "landing", count: 1 },
      { day: "2026-10-03", channel: "newsletter", step: "landing", count: 2 },
      { day: "2026-10-03", channel: "newsletter", step: "signup", count: 1 },
    ]);
  });

  it("counts parallel visits without losing any", async () => {
    const test = await setUp();
    await Promise.all(Array.from({ length: 20 }, () => recordFunnelStep(test.ctx, { step: "pricing", channel: "ads" })));
    expect(await listCounts(test)).toEqual([{ day: "2026-10-03", channel: "ads", step: "pricing", count: 20 }]);
  });

  it("counts an invalid channel as none, never cutting or repairing it", async () => {
    const test = await setUp();
    await recordFunnelStep(test.ctx, { step: "landing", channel: "News Letter" });
    await recordFunnelStep(test.ctx, { step: "landing", channel: "x".repeat(33) });
    await recordFunnelStep(test.ctx, { step: "landing", channel: OVERFLOW_CHANNEL });
    expect(await listCounts(test)).toEqual([{ day: "2026-10-03", channel: "", step: "landing", count: 3 }]);
  });

  it("refuses a step the funnel does not declare", async () => {
    const test = await setUp();
    await expect(recordFunnelStep(test.ctx, { step: "checkuot", channel: null })).rejects.toThrow(
      '@softure-ai/analytics: "checkuot" is not a step of analytics({ funnel: { steps } })',
    );
    expect(await listCounts(test)).toEqual([]);
  });

  it("puts the day boundary at midnight in the app's time zone, not the server's", async () => {
    const test = await setUp();
    // 23:59 and 00:00 in Warsaw (UTC+2 in October).
    test.clock.set(new Date("2026-10-03T21:59:00Z"));
    await recordFunnelStep(test.ctx, { step: "landing", channel: null });
    test.clock.set(new Date("2026-10-03T22:00:00Z"));
    await recordFunnelStep(test.ctx, { step: "landing", channel: null });

    expect((await listCounts(test)).map((row) => row.day)).toEqual(["2026-10-03", "2026-10-04"]);
  });

  describe("the daily cap on new channels", () => {
    const CAPPED = { funnel: { steps: [{ id: "landing", via: "pixel" as const }], channelCap: 2 } };

    it("counts new channels past the cap under the overflow key", async () => {
      const test = await setUp(CAPPED);
      for (const channel of ["a", "b", "c", "d"]) await recordFunnelStep(test.ctx, { step: "landing", channel });
      await recordFunnelStep(test.ctx, { step: "landing", channel: null });

      expect(await listCounts(test)).toEqual([
        { day: "2026-10-03", channel: "", step: "landing", count: 1 },
        { day: "2026-10-03", channel: "a", step: "landing", count: 1 },
        { day: "2026-10-03", channel: "b", step: "landing", count: 1 },
        { day: "2026-10-03", channel: OVERFLOW_CHANNEL, step: "landing", count: 2 },
      ]);
    });

    it("never caps a channel counted today or on an earlier day, and starts over each day", async () => {
      const test = await setUp(CAPPED);
      await recordFunnelStep(test.ctx, { step: "landing", channel: "veteran" });
      test.clock.advance(DAY_MS);
      for (const channel of ["a", "b", "c"]) await recordFunnelStep(test.ctx, { step: "landing", channel });
      await recordFunnelStep(test.ctx, { step: "landing", channel: "veteran" });
      await recordFunnelStep(test.ctx, { step: "landing", channel: "a" });

      expect(await listCounts(test)).toEqual([
        { day: "2026-10-03", channel: "veteran", step: "landing", count: 1 },
        { day: "2026-10-04", channel: "a", step: "landing", count: 2 },
        { day: "2026-10-04", channel: "b", step: "landing", count: 1 },
        { day: "2026-10-04", channel: "veteran", step: "landing", count: 1 },
        { day: "2026-10-04", channel: OVERFLOW_CHANNEL, step: "landing", count: 1 },
      ]);
    });
  });

  describe("funnel.isKnownChannel", () => {
    it("never caps a channel the app knows from its own tables, and is not asked without a channel", async () => {
      const asked: string[] = [];
      const test = await setUp({
        funnel: {
          steps: [{ id: "landing", via: "pixel" }],
          channelCap: 1,
          isKnownChannel: (channel) => {
            asked.push(channel);
            return Promise.resolve(channel === "partner");
          },
        },
      });
      for (const channel of ["a", "b", "partner", null]) await recordFunnelStep(test.ctx, { step: "landing", channel });

      expect(asked).toEqual(["a", "b", "partner"]);
      expect(await listCounts(test)).toEqual([
        { day: "2026-10-03", channel: "", step: "landing", count: 1 },
        { day: "2026-10-03", channel: "a", step: "landing", count: 1 },
        { day: "2026-10-03", channel: "partner", step: "landing", count: 1 },
        { day: "2026-10-03", channel: OVERFLOW_CHANNEL, step: "landing", count: 1 },
      ]);
    });

    it("passes the hook the counter's context and lets its failure propagate", async () => {
      const test = await setUp({
        funnel: {
          steps: [{ id: "landing", via: "pixel" }],
          isKnownChannel: (_channel, ctx) => {
            if (ctx.config.timezone === "Europe/Warsaw") throw new Error("lookup failed");
            return false;
          },
        },
      });
      await expect(recordFunnelStep(test.ctx, { step: "landing", channel: "a" })).rejects.toThrow("lookup failed");
      expect(await listCounts(test)).toEqual([]);
    });
  });

  it("is refused by the table for a step id it cannot store (the constraint is the first line)", async () => {
    const test = await setUp();
    await expect(test.database.client.query("INSERT INTO analytics.funnel_counts VALUES ('2026-10-03', '', 'Bad Step', 1)")).rejects.toThrow();
    await expect(test.database.client.query("INSERT INTO analytics.funnel_counts VALUES ('2026-10-03', '', 'landing', 0)")).rejects.toThrow();
  });
});

describe("getFunnelReport", () => {
  it("is empty, with zero totals, when nothing was counted", async () => {
    const test = await setUp();
    expect(await getFunnelReport(test.ctx)).toEqual({
      from: "2026-09-04",
      to: "2026-10-03",
      steps: ["landing", "pricing", "checkout", "signup"],
      rows: [],
      total: { landing: 0, pricing: 0, checkout: 0, signup: 0 },
    });
  });

  it("returns the funnel per channel in step order, the busiest channel first, with totals", async () => {
    const test = await setUp();
    const visit = async (channel: string | null, steps: readonly string[]) => {
      for (const step of steps) await recordFunnelStep(test.ctx, { step, channel });
    };
    await visit("newsletter", ["landing", "pricing", "checkout", "signup"]);
    await visit("newsletter", ["landing", "pricing"]);
    await visit("ads", ["landing", "pricing", "checkout"]);
    await visit("ads", ["landing"]);
    await visit("ads", ["landing"]);
    await visit(null, ["landing", "signup"]);

    const report = await getFunnelReport(test.ctx, { days: 7 });
    expect(report.from).toBe("2026-09-27");
    expect(report.to).toBe("2026-10-03");
    expect(report.rows).toEqual([
      { channel: { kind: "tagged", channel: "ads" }, counts: { landing: 3, pricing: 1, checkout: 1, signup: 0 } },
      { channel: { kind: "tagged", channel: "newsletter" }, counts: { landing: 2, pricing: 2, checkout: 1, signup: 1 } },
      { channel: { kind: "untagged" }, counts: { landing: 1, pricing: 0, checkout: 0, signup: 1 } },
    ]);
    expect(report.total).toEqual({ landing: 6, pricing: 3, checkout: 2, signup: 2 });
  });

  it("reads only the window's days and marks the overflow bucket", async () => {
    const test = await setUp({ funnel: { steps: [{ id: "landing", via: "pixel" }], channelCap: 1 } });
    await recordFunnelStep(test.ctx, { step: "landing", channel: "old" });
    test.clock.advance(3 * DAY_MS);
    await recordFunnelStep(test.ctx, { step: "landing", channel: "fresh" });
    await recordFunnelStep(test.ctx, { step: "landing", channel: "flood" });

    expect((await getFunnelReport(test.ctx, { days: 3 })).rows).toEqual([
      { channel: { kind: "overflow" }, counts: { landing: 1 } },
      { channel: { kind: "tagged", channel: "fresh" }, counts: { landing: 1 } },
    ]);
    expect((await getFunnelReport(test.ctx, { days: 4 })).total).toEqual({ landing: 3 });
  });

  it("leaves out steps the funnel no longer declares", async () => {
    const test = await setUp();
    await recordFunnelStep(test.ctx, { step: "landing", channel: null });
    await recordFunnelStep(test.ctx, { step: "pricing", channel: null });
    const narrowed = { ...test.ctx, config: createConfig({ funnel: { steps: [{ id: "pricing" }] } }) };
    expect(await getFunnelReport(narrowed)).toMatchObject({ steps: ["pricing"], rows: [{ channel: { kind: "untagged" }, counts: { pricing: 1 } }] });
  });

  it("refuses a window it cannot read", async () => {
    const test = await setUp();
    for (const days of [0, 1.5, 3661]) {
      await expect(getFunnelReport(test.ctx, { days })).rejects.toThrow(`getFunnelReport: days must be a whole number from 1 to 3660, got ${String(days)}`);
    }
  });
});

describe("pruneFunnelCounts", () => {
  it("deletes the days before the last keepDays, today included", async () => {
    const test = await setUp();
    for (let day = 0; day < 4; day += 1) {
      await recordFunnelStep(test.ctx, { step: "landing", channel: null });
      test.clock.advance(DAY_MS);
    }
    test.clock.advance(-DAY_MS);
    await pruneFunnelCounts(test.ctx, { keepDays: 2 });
    expect((await listCounts(test)).map((row) => row.day)).toEqual(["2026-10-05", "2026-10-06"]);
    await expect(pruneFunnelCounts(test.ctx, { keepDays: 0 })).rejects.toThrow("pruneFunnelCounts: keepDays must be a whole number of at least 1, got 0");
  });
});

describe("formatDay", () => {
  it("gives the calendar day in the zone, whatever the server's", () => {
    expect(formatDay(new Date("2026-10-03T22:30:00Z"), "Europe/Warsaw")).toBe("2026-10-04");
    expect(formatDay(new Date("2026-10-03T22:30:00Z"), "America/New_York")).toBe("2026-10-03");
    expect(formatDay(new Date("2026-01-05T00:30:00Z"), "UTC")).toBe("2026-01-05");
  });
});
