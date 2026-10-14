// Steering single jobs and the upkeep functions: cancel, retry, prune, stats.
import { err, ok } from "@softure-ai/core";
import { defineJobHandler } from "@softure-ai/jobs";
import { cancelJob, claimJobs, enqueueJob, getJob, getQueueStats, pruneJobs, retryJob } from "@softure-ai/jobs/server";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

const DAY_MS = 24 * 60 * 60 * SECOND_MS;
const failing = { "mail.send": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(err("app.bounced")) }) };
const passing = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };

describe("job administration", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("cancels a pending job, and refuses a running one or an unknown id", async () => {
    const pending = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    expect(await cancelJob(test.ctx, pending.id)).toMatchObject({ ok: true, value: { status: "cancelled", finishedAt: NOW } });

    const running = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "worker" });
    expect(await cancelJob(test.ctx, running.id)).toEqual(err("jobs.not_cancellable"));
    expect(await cancelJob(test.ctx, "999")).toEqual(err("jobs.not_found"));
    expect(await cancelJob(test.ctx, "not-an-id")).toEqual(err("jobs.not_found"));
    expect(await getJob(test.ctx, "99999999999999999999")).toBeNull();
  });

  it("runs a failed job again from scratch", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {}, dedupKey: "mail-1" });
    await runDueJobs(test.ctx, { handlers: failing, random: () => 0 });
    test.clock.advance(SECOND_MS);

    expect(await retryJob(test.ctx, id)).toMatchObject({ ok: true, value: { status: "pending", attempts: 0, finishedAt: null, runAt: new Date(NOW.getTime() + SECOND_MS) } });
    expect(await retryJob(test.ctx, id)).toEqual(err("jobs.not_retryable"));
    expect(await retryJob(test.ctx, "0")).toEqual(err("jobs.not_found"));
  });

  it("refuses to retry a job while another live job has its dedup key", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {}, dedupKey: "mail-1" });
    await runDueJobs(test.ctx, { handlers: failing, random: () => 0 });
    await enqueueJob(test.ctx, { queue: "mail.send", payload: {}, dedupKey: "mail-1" });
    expect(await retryJob(test.ctx, id)).toEqual(err("jobs.dedup_key_taken"));
  });

  it("prunes finished jobs past their retention and keeps the rest", async () => {
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });
    await runDueJobs(test.ctx, { handlers: { ...passing, ...failing }, random: () => 0 });
    const cancelled = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, delaySeconds: 60 });
    await cancelJob(test.ctx, cancelled.id);
    const pending = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, delaySeconds: (40 * DAY_MS) / SECOND_MS });

    test.clock.advance(7 * DAY_MS);
    expect(await pruneJobs(test.ctx)).toBe(0);
    test.clock.advance(SECOND_MS);
    expect(await pruneJobs(test.ctx)).toBe(2);
    expect((await listJobs(test.database.db)).map((job) => job.status)).toEqual(["failed", "pending"]);
    test.clock.advance(23 * DAY_MS);
    expect(await pruneJobs(test.ctx)).toBe(1);
    expect((await listJobs(test.database.db)).map((job) => job.id)).toEqual([pending.id]);
  });

  it("counts jobs per queue and status with the due backlog", async () => {
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    test.clock.advance(SECOND_MS);
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, delaySeconds: 60 });
    await test.database.client.query(
      "INSERT INTO jobs.jobs (queue, payload, status, attempts, max_attempts, run_at, created_at, updated_at) VALUES ('old.queue', '{}', 'pending', 0, 1, $1, $1, $1)",
      [NOW],
    );

    expect(await getQueueStats(test.ctx)).toEqual([
      { queue: "ai.reply", counts: { pending: 3, running: 0, succeeded: 0, failed: 0, cancelled: 0 }, due: 2, oldestDueAt: NOW },
      { queue: "mail.send", counts: { pending: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 }, due: 0, oldestDueAt: null },
      { queue: "old.queue", counts: { pending: 1, running: 0, succeeded: 0, failed: 0, cancelled: 0 }, due: 1, oldestDueAt: NOW },
    ]);
  });
});
