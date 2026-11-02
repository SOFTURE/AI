// A signed-in user follows their own job (issue #958): the owner is stored on enqueue, getOwnJob and
// requestOwnJobCancel answer only the owner (a job of someone else looks missing), the user sees codes and a result
// reference, never the payload or an error's text, and pruning keeps an owned job readable for `retention.ownedDays`.
import { ok } from "@softure-ai/core";
import { defineJobHandler, failJob, type JobHandlers } from "@softure-ai/jobs";
import {
  claimJobs,
  enqueueJob,
  getJob,
  getOwnJob,
  pruneJobs,
  requestOwnJobCancel,
  retryJob,
  toOwnJobStatus,
  type JobsLogger,
} from "@softure-ai/jobs/server";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

const DAY_MS = 24 * 60 * 60 * SECOND_MS;
const payload = z.object({ articleId: z.string() });

function createLogger(): JobsLogger & { lines: string[] } {
  const lines: string[] = [];
  const write = (level: string) => (message: string) => lines.push(`${level}: ${message}`);
  return { lines, info: write("info"), warn: write("warn"), error: write("error") };
}

describe("owned jobs", () => {
  let test: TestJobs;
  let logger: ReturnType<typeof createLogger>;

  beforeEach(async () => {
    test = await createTestJobs();
    logger = createLogger();
  });
  afterEach(async () => {
    await test.database.close();
  });

  function run(handlers: JobHandlers) {
    return runDueJobs(test.ctx, { handlers, logger, random: () => 0 });
  }

  it("stores the owner and answers the owner with the job's state, never its payload", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "secret-a" }, ownerId: "user-1" });
    expect((await getJob(test.ctx, id))?.ownerId).toBe("user-1");
    const own = await getOwnJob(test.ctx, { id, ownerId: "user-1" });
    expect(own).toEqual({
      ok: true,
      value: {
        id,
        queue: "ai.reply",
        status: "pending",
        progress: null,
        progressAt: null,
        resultRef: null,
        failureCode: null,
        cancelRequestedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
        finishedAt: null,
      },
    });
    expect(JSON.stringify(own)).not.toContain("secret-a");
  });

  it("answers not_found for another owner, a job without an owner, an unknown id and an id that cannot be one", async () => {
    const owned = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "a" }, ownerId: "user-1" });
    const unowned = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "b" } });
    const notFound = { ok: false, error: "jobs.not_found" };
    expect(await getOwnJob(test.ctx, { id: owned.id, ownerId: "user-2" })).toEqual(notFound);
    expect(await getOwnJob(test.ctx, { id: unowned.id, ownerId: "user-1" })).toEqual(notFound);
    expect(await getOwnJob(test.ctx, { id: "999999", ownerId: "user-1" })).toEqual(notFound);
    expect(await getOwnJob(test.ctx, { id: "../1", ownerId: "user-1" })).toEqual(notFound);
  });

  it("refuses an empty or too long owner id", async () => {
    await expect(enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, ownerId: "" })).rejects.toThrow(RangeError);
    await expect(enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, ownerId: "u".repeat(201) })).rejects.toThrow(RangeError);
    await expect(enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, ownerId: "u".repeat(200) })).resolves.toMatchObject({ isDuplicate: false });
  });

  it("keeps the result reference a succeeded handler returns, with or without a summary", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "a" }, ownerId: "user-1" });
    await run({
      "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(ok({ resultRef: "summary:42", summary: { code: "ai.summarized" } })) }),
    });
    const own = await getOwnJob(test.ctx, { id, ownerId: "user-1" });
    expect(own).toMatchObject({ ok: true, value: { status: "succeeded", resultRef: "summary:42", failureCode: null, finishedAt: NOW } });
    expect(logger.lines).not.toContain("warn: job result reference is not an identifier; recorded without it");
  });

  it("drops a result reference that is not an identifier with a warning, and the job stays succeeded", async () => {
    const free = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "a" }, ownerId: "user-1" });
    await run({ "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(ok({ resultRef: "Dear Anna, here is your text" })) }) });
    const numeric = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "b" }, ownerId: "user-1" });
    await run({ "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(ok({ resultRef: 42 })) }) });
    for (const id of [free.id, numeric.id]) {
      expect(await getOwnJob(test.ctx, { id, ownerId: "user-1" })).toMatchObject({ ok: true, value: { status: "succeeded", resultRef: null } });
    }
    expect(logger.lines.filter((line) => line === "warn: job result reference is not an identifier; recorded without it")).toHaveLength(2);
    expect(logger.lines.join("\n")).not.toContain("Dear Anna");
  });

  it("gives a failed job's code and a cancelled job's code, never an error's text", async () => {
    const failed = await enqueueJob(test.ctx, { queue: "mail.send", payload: { articleId: "a" }, ownerId: "user-1" });
    await run({ "mail.send": defineJobHandler({ payload, run: () => Promise.resolve(failJob("ai.too_long")) }) });
    const thrown = await enqueueJob(test.ctx, { queue: "mail.send", payload: { articleId: "b" }, ownerId: "user-1" });
    await run({
      "mail.send": defineJobHandler({
        payload,
        run: () => Promise.reject(new Error("provider said: user text here")),
      }),
    });
    const cancelled = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "c" }, ownerId: "user-1" });
    await requestOwnJobCancel(test.ctx, { id: cancelled.id, ownerId: "user-1" });

    expect(await getOwnJob(test.ctx, { id: failed.id, ownerId: "user-1" })).toMatchObject({ value: { status: "failed", failureCode: "ai.too_long" } });
    const threw = await getOwnJob(test.ctx, { id: thrown.id, ownerId: "user-1" });
    expect(threw).toMatchObject({ value: { status: "failed", failureCode: "jobs.handler_threw" } });
    expect(JSON.stringify(threw)).not.toContain("user text");
    expect(await getOwnJob(test.ctx, { id: cancelled.id, ownerId: "user-1" })).toMatchObject({ value: { status: "cancelled", failureCode: "jobs.cancelled" } });
  });

  it("lets the owner cancel a pending job and ask a running one to stop; others get not_found", async () => {
    const pending = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "a" }, ownerId: "user-1" });
    expect(await requestOwnJobCancel(test.ctx, { id: pending.id, ownerId: "user-2" })).toEqual({ ok: false, error: "jobs.not_found" });
    expect((await getJob(test.ctx, pending.id))?.status).toBe("pending");
    expect(await requestOwnJobCancel(test.ctx, { id: pending.id, ownerId: "user-1" })).toMatchObject({ ok: true, value: { status: "cancelled", finishedAt: NOW } });
    expect(await requestOwnJobCancel(test.ctx, { id: pending.id, ownerId: "user-1" })).toEqual({ ok: false, error: "jobs.not_cancellable" });

    const running = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "b" }, ownerId: "user-1" });
    await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "test" });
    expect(await requestOwnJobCancel(test.ctx, { id: running.id, ownerId: "user-2" })).toEqual({ ok: false, error: "jobs.not_found" });
    expect((await getJob(test.ctx, running.id))?.cancelRequestedAt).toBeNull();
    expect(await requestOwnJobCancel(test.ctx, { id: running.id, ownerId: "user-1" })).toMatchObject({
      ok: true,
      value: { status: "running", cancelRequestedAt: NOW },
    });
    expect(await requestOwnJobCancel(test.ctx, { id: "x", ownerId: "user-1" })).toEqual({ ok: false, error: "jobs.not_found" });
  });

  it("clears the result reference when an operator runs a cancelled job again", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "a" }, ownerId: "user-1" });
    await requestOwnJobCancel(test.ctx, { id, ownerId: "user-1" });
    expect(await retryJob(test.ctx, id)).toMatchObject({ ok: true, value: { status: "pending", resultRef: null, ownerId: "user-1" } });
  });

  it("turns an owned job into JSON with ISO times", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "a" }, ownerId: "user-1" });
    await requestOwnJobCancel(test.ctx, { id, ownerId: "user-1" });
    const own = await getOwnJob(test.ctx, { id, ownerId: "user-1" });
    if (!own.ok) throw new Error("test: expected the job");
    expect(toOwnJobStatus(own.value)).toEqual({
      id,
      queue: "ai.reply",
      status: "cancelled",
      progress: null,
      progressAt: null,
      resultRef: null,
      failureCode: "jobs.cancelled",
      cancelRequestedAt: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      finishedAt: NOW.toISOString(),
    });
  });
});

describe("pruning owned jobs", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  async function finish(ownerId?: string): Promise<string> {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { articleId: "a" }, ...(ownerId === undefined ? {} : { ownerId }) });
    await runDueJobs(test.ctx, { handlers: { "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(ok()) }) } });
    return id;
  }

  it("keeps an owned job for ownedDays even when its status retention is shorter", async () => {
    test = await createTestJobs({ retention: { succeededDays: 0, failedDays: 30, cancelledDays: 7, syncItemsDays: 90, runsDays: 30, ownedDays: 2 } });
    const owned = await finish("user-1");
    const unowned = await finish();
    test.clock.advance(DAY_MS);
    expect(await pruneJobs(test.ctx)).toBe(1);
    expect(await getJob(test.ctx, unowned)).toBeNull();
    expect(await getOwnJob(test.ctx, { id: owned, ownerId: "user-1" })).toMatchObject({ ok: true });
    test.clock.advance(DAY_MS + SECOND_MS);
    expect(await pruneJobs(test.ctx)).toBe(1);
    expect(await getOwnJob(test.ctx, { id: owned, ownerId: "user-1" })).toEqual({ ok: false, error: "jobs.not_found" });
  });

  it("lets a longer status retention win over ownedDays", async () => {
    test = await createTestJobs({ retention: { succeededDays: 3, failedDays: 30, cancelledDays: 7, syncItemsDays: 90, runsDays: 30, ownedDays: 1 } });
    const owned = await finish("user-1");
    test.clock.advance(2 * DAY_MS);
    expect(await pruneJobs(test.ctx)).toBe(0);
    test.clock.advance(DAY_MS + SECOND_MS);
    expect(await pruneJobs(test.ctx)).toBe(1);
    expect(await getJob(test.ctx, owned)).toBeNull();
  });
});
