// Enqueueing: defaults from the queue, delays, dedup keys inside and outside transactions.
import { enqueueJob, getJob } from "@softure-ai/jobs/server";
import { listJobs } from "@softure-ai/jobs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

describe("enqueueJob", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("writes a pending job due now with the queue's attempts", async () => {
    const enqueued = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });
    expect(enqueued.isDuplicate).toBe(false);
    expect(await getJob(test.ctx, enqueued.id)).toEqual({
      id: enqueued.id,
      queue: "ai.reply",
      payload: { messageId: "m-1" },
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      runAt: NOW,
      lockedUntil: null,
      lockedBy: null,
      dedupKey: null,
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
      finishedAt: null,
    });
  });

  it("takes a delay, a due date and its own attempts", async () => {
    const delayed = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, delaySeconds: 90, maxAttempts: 7 });
    const dated = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, runAt: new Date("2026-09-16T08:00:00Z") });
    expect(await getJob(test.ctx, delayed.id)).toMatchObject({ runAt: new Date(NOW.getTime() + 90 * SECOND_MS), maxAttempts: 7 });
    expect(await getJob(test.ctx, dated.id)).toMatchObject({ runAt: new Date("2026-09-16T08:00:00Z") });
  });

  it("returns the live job for a repeated dedup key instead of writing a second one", async () => {
    const first = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { n: 1 }, dedupKey: "message-1" });
    const second = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { n: 2 }, dedupKey: "message-1" });
    const otherQueue = await enqueueJob(test.ctx, { queue: "mail.send", payload: {}, dedupKey: "message-1" });
    expect(second).toEqual({ id: first.id, isDuplicate: true });
    expect(otherQueue.isDuplicate).toBe(false);
    expect((await listJobs(test.database.db)).map((job) => job.payload)).toEqual([{ n: 1 }, {}]);
  });

  it("writes the job with the caller's transaction, and not at all when it rolls back", async () => {
    await test.database.db
      .transaction(async (tx) => {
        await enqueueJob({ ...test.ctx, db: tx }, { queue: "ai.reply", payload: {}, dedupKey: "message-1" });
        throw new Error("the caller's write failed");
      })
      .catch(() => undefined);
    expect(await listJobs(test.database.db)).toEqual([]);

    await test.database.db.transaction(async (tx) => {
      await enqueueJob({ ...test.ctx, db: tx }, { queue: "ai.reply", payload: {}, dedupKey: "message-1" });
    });
    expect(await listJobs(test.database.db)).toHaveLength(1);
  });

  it.each([
    ["an unknown queue", { queue: "ai.unknown", payload: {} }, 'unknown queue "ai.unknown"'],
    ["both runAt and delaySeconds", { queue: "ai.reply", payload: {}, runAt: NOW, delaySeconds: 1 }, "runAt or delaySeconds"],
    ["a negative delay", { queue: "ai.reply", payload: {}, delaySeconds: -1 }, "delaySeconds"],
    ["an empty dedup key", { queue: "ai.reply", payload: {}, dedupKey: "" }, "dedup key"],
    ["zero attempts", { queue: "ai.reply", payload: {}, maxAttempts: 0 }, "maxAttempts"],
    ["no payload", { queue: "ai.reply", payload: undefined }, "needs a payload"],
    ["a null payload", { queue: "ai.reply", payload: null }, "needs a payload"],
  ])("refuses %s", async (_case, input, message) => {
    await expect(enqueueJob(test.ctx, input)).rejects.toThrow(message);
  });
});
