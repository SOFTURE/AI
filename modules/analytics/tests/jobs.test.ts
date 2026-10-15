// The jobs adapter: the schedule carries the app's `keepDays` and its handler runs `pruneFunnelCounts` with it.
import { analyticsJobHandlers, createAnalyticsJobSchedules } from "@softure-ai/analytics/jobs";
import { recordFunnelStep } from "@softure-ai/analytics/server";
import { jobs, jobsOptionsSchema } from "@softure-ai/jobs";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { createTestFunnel, FUNNEL_STEPS, listCounts, type TestFunnel } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("the analytics jobs", () => {
  let test: TestFunnel | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("schedules a handler for every queue it names, with the app's keepDays", () => {
    const schedules = createAnalyticsJobSchedules({ keepDays: 400 });
    expect(Object.keys(schedules)).toEqual(Object.keys(analyticsJobHandlers));
    expect(jobsOptionsSchema.parse({ schedules }).schedules).toEqual({
      "analytics.prune-funnel-counts": { every: "1d", payload: { keepDays: 400 } },
    });
  });

  it.each([0, 1.5, -3])("refuses keepDays %d", (keepDays) => {
    expect(() => createAnalyticsJobSchedules({ keepDays })).toThrow(
      `createAnalyticsJobSchedules: keepDays must be a whole number of at least 1, got ${String(keepDays)}`,
    );
  });

  it("prunes the funnel counts before the kept days on its schedule", async () => {
    test = await createTestFunnel({ funnel: { steps: [...FUNNEL_STEPS] } }, [jobs({ schedules: createAnalyticsJobSchedules({ keepDays: 2 }) })]);
    for (let day = 0; day < 4; day += 1) {
      await recordFunnelStep(test.ctx, { step: "landing", channel: null });
      test.clock.advance(DAY_MS);
    }
    test.clock.advance(-DAY_MS);

    expect(await runDueJobs(test.ctx, { handlers: analyticsJobHandlers })).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect((await listCounts(test)).map((row) => row.day)).toEqual(["2026-10-05", "2026-10-06"]);
    expect((await listJobs(test.database.db)).map((job) => job.payload)).toEqual([{ keepDays: 2 }]);
  });
});
