// The prune job: charges past the kept days and expired reservations go; the rest stays.
import { jobs, jobsOptionsSchema } from "@softure-ai/jobs";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { createMeteringJobSchedules, meteringJobHandlers } from "@softure-ai/metering/jobs";
import { pruneCharges, recordCharge, reserveSpend } from "@softure-ai/metering/server";
import { afterEach, describe, expect, it } from "vitest";
import { createConfig, createTestMetering, listRows, NOW, OPTIONS, type TestMetering } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("the metering jobs", () => {
  let test: TestMetering | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("schedules a daily handler for every queue it names, with the app's keepDays", () => {
    const schedules = createMeteringJobSchedules({ keepDays: 400 });
    expect(Object.keys(schedules)).toEqual(Object.keys(meteringJobHandlers));
    expect(jobsOptionsSchema.parse({ schedules }).schedules).toEqual({ "metering.prune-charges": { every: "1d", payload: { keepDays: 400 } } });
  });

  it.each([31, 40.5, 0])("refuses keepDays %d", (keepDays) => {
    expect(() => createMeteringJobSchedules({ keepDays })).toThrow(
      `createMeteringJobSchedules: keepDays must be a whole number of at least 32, got ${String(keepDays)}`,
    );
  });

  it("deletes charges older than the kept days and expired reservations", async () => {
    test = await createTestMetering();
    await recordCharge(test.ctx, { provider: "search", amount: 1, step: "old", at: new Date(NOW.getTime() - 33 * DAY_MS) });
    await recordCharge(test.ctx, { provider: "search", amount: 2, step: "kept", at: new Date(NOW.getTime() - 31 * DAY_MS) });
    await reserveSpend(test.ctx, { provider: "search", amount: 3, step: "expired" });
    test.clock.advance(2 * 60 * 60 * 1000);
    await reserveSpend(test.ctx, { provider: "search", amount: 4, step: "running" });

    expect(await pruneCharges(test.ctx, { keepDays: 32 })).toEqual({ ok: true, value: { deletedCharges: 2 } });
    expect(await listRows(test.database)).toEqual(["search settled 2 - kept", "search reserved 4 - running"]);
  });

  it("prunes on its schedule", async () => {
    test = await createTestMetering(createConfig(OPTIONS, [jobs({ schedules: createMeteringJobSchedules({ keepDays: 32 }) })]));
    await recordCharge(test.ctx, { provider: "search", amount: 1, at: new Date(NOW.getTime() - 40 * DAY_MS) });

    expect(await runDueJobs(test.ctx, { handlers: meteringJobHandlers })).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(await listRows(test.database)).toEqual([]);
    expect((await listJobs(test.database.db)).map((job) => job.payload)).toEqual([{ keepDays: 32 }]);
  });
});
