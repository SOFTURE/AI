// The admin page's steering functions: recent jobs, running a schedule now, putting a failed sync item back.
import { err, ok } from "@softure-ai/core";
import { defineJobHandler, failSyncItem } from "@softure-ai/jobs";
import {
  cancelJob,
  enqueueDueSchedules,
  enqueueJob,
  listRecentJobs,
  listSyncItems,
  processSyncItem,
  retrySyncItem,
  runScheduleNow,
  SCHEDULE_DEDUP_KEY,
} from "@softure-ai/jobs/server";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestJobs, SECOND_MS, type TestJobs } from "./support.js";

const SOURCE = "gmail.inbox";
const failing = { "mail.send": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(err("app.bounced")) }) };
const retrying = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(err("app.rate_limited")) }) };

describe("listRecentJobs", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("lists jobs of the given statuses, most recently updated first, filtered by queue", async () => {
    const failed = await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });
    await runDueJobs(test.ctx, { handlers: failing, random: () => 0 });
    test.clock.advance(SECOND_MS);
    const cancelled = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, delaySeconds: 60 });
    await cancelJob(test.ctx, cancelled.id);
    test.clock.advance(SECOND_MS);
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    const recent = await listRecentJobs(test.ctx, { statuses: ["failed", "cancelled"] });
    expect(recent.map((job) => [job.id, job.status, job.lastError])).toEqual([
      [cancelled.id, "cancelled", null],
      [failed.id, "failed", "app.bounced"],
    ]);
    expect((await listRecentJobs(test.ctx, { statuses: ["failed", "cancelled"], queue: "mail.send" })).map((job) => job.id)).toEqual([failed.id]);
    expect(await listRecentJobs(test.ctx, { statuses: ["failed"], queue: "nobody.here" })).toEqual([]);
    expect(await listRecentJobs(test.ctx, { statuses: [] })).toEqual([]);
  });

  it("lists only pending jobs waiting for a retry when asked for retrying ones", async () => {
    const retried = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await runDueJobs(test.ctx, { handlers: retrying, random: () => 0 });
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, delaySeconds: 600 });

    expect((await listRecentJobs(test.ctx, { statuses: ["retrying"] })).map((job) => [job.id, job.status, job.attempts, job.lastError])).toEqual([
      [retried.id, "pending", 1, "app.rate_limited"],
    ]);
  });

  it("returns at most limit jobs and refuses a limit outside 1 to 500", async () => {
    for (let index = 0; index < 3; index += 1) {
      const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, delaySeconds: 60 });
      await cancelJob(test.ctx, id);
    }
    expect(await listRecentJobs(test.ctx, { statuses: ["cancelled"], limit: 2 })).toHaveLength(2);
    await expect(listRecentJobs(test.ctx, { statuses: ["cancelled"], limit: 0 })).rejects.toThrow("limit must be an integer from 1 to 500");
    await expect(listRecentJobs(test.ctx, { statuses: ["cancelled"], limit: 501 })).rejects.toThrow("limit must be an integer from 1 to 500");
  });
});

describe("runScheduleNow", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs({ schedules: { "reports.daily": { every: "1d", payload: { kind: "daily" } } } });
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("enqueues a run with the schedule's payload and dedup key, joining a pending one", async () => {
    const first = await runScheduleNow(test.ctx, "reports.daily");
    expect(first).toEqual(ok({ id: expect.any(String) as string, isDuplicate: false }));
    expect(await runScheduleNow(test.ctx, "reports.daily")).toEqual(ok({ id: first.ok ? first.value.id : "", isDuplicate: true }));

    const [job] = await listJobs(test.database.db);
    expect(job).toMatchObject({ queue: "reports.daily", payload: { kind: "daily" }, dedupKey: SCHEDULE_DEDUP_KEY, status: "pending" });
  });

  it("leaves the schedule's period alone, so the regular run still comes", async () => {
    await runScheduleNow(test.ctx, "reports.daily");
    expect(await enqueueDueSchedules(test.ctx)).toEqual(["reports.daily"]);
    expect(await listJobs(test.database.db)).toHaveLength(1);
  });

  it("refuses a queue that is not a schedule", async () => {
    expect(await runScheduleNow(test.ctx, "ai.reply")).toEqual(err("jobs.not_a_schedule"));
    expect(await runScheduleNow(test.ctx, "nobody.here")).toEqual(err("jobs.not_a_schedule"));
    expect(await listJobs(test.database.db)).toEqual([]);
  });
});

describe("retrySyncItem", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("puts a failed item back to pending with its attempts reset, so the next run handles it", async () => {
    await processSyncItem(test.ctx, { source: SOURCE, itemId: "m-1" }, () => Promise.resolve(failSyncItem("app.unparseable")));
    test.clock.advance(SECOND_MS);

    const retried = await retrySyncItem(test.ctx, { source: SOURCE, itemId: "m-1" });
    expect(retried).toMatchObject({ ok: true, value: { status: "pending", attempts: 0, errorCode: null, finishedAt: null } });
    const outcome = await processSyncItem(test.ctx, { source: SOURCE, itemId: "m-1", maxAttempts: 1 }, () => Promise.resolve(ok()));
    expect(outcome).toMatchObject({ kind: "handled", item: { status: "done", attempts: 1 } });
  });

  it("refuses an item that is not failed, and one the ledger does not have", async () => {
    await processSyncItem(test.ctx, { source: SOURCE, itemId: "m-1" }, () => Promise.resolve(ok()));
    expect(await retrySyncItem(test.ctx, { source: SOURCE, itemId: "m-1" })).toEqual(err("jobs.sync_item_not_retryable"));
    expect(await retrySyncItem(test.ctx, { source: SOURCE, itemId: "m-2" })).toEqual(err("jobs.sync_item_not_found"));
    expect(await retrySyncItem(test.ctx, { source: "Not A Source", itemId: "m-1" })).toEqual(err("jobs.sync_item_not_found"));
    expect((await listSyncItems(test.ctx)).map((item) => item.status)).toEqual(["done"]);
  });
});
