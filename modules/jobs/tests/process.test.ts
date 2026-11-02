// Running jobs: success, retries with backoff, terminal failures, invalid payloads, thrown handlers, leases and the
// fencing of stale workers. Driven through runDueJobs and the claim functions the worker uses.
import { err, ok } from "@softure-ai/core";
import { defineJobHandler, failJob, retryJobLater, type JobHandlers } from "@softure-ai/jobs";
import { claimJobs, completeJob, enqueueJob, extendJobLease, getJob, releaseJob, type JobsLogger } from "@softure-ai/jobs/server";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

const payload = z.strictObject({ messageId: z.string() });

function createLogger(): JobsLogger & { lines: string[] } {
  const lines: string[] = [];
  const write = (level: string) => (message: string) => lines.push(`${level}: ${message}`);
  return { lines, info: write("info"), warn: write("warn"), error: write("error") };
}

describe("running jobs", () => {
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

  it("runs a due job with its parsed payload and marks it succeeded", async () => {
    const seen: string[] = [];
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async ({ messageId }, context) => {
          seen.push(`${messageId}#${String(context.job.attempts)}`);
          return Promise.resolve(ok());
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });

    expect(await run(handlers)).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(seen).toEqual(["m-1#1"]);
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "succeeded", attempts: 1, finishedAt: NOW, lockedUntil: null, lockedBy: null, lastError: null });
  });

  it("leaves jobs that are not due yet", async () => {
    const handlers = { "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(ok()) }) };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: "m-1" }, delaySeconds: 5 });
    expect(await run(handlers)).toEqual({ succeeded: 0, retried: 0, failed: 0, stale: 0 });
    test.clock.advance(5 * SECOND_MS);
    expect(await run(handlers)).toMatchObject({ succeeded: 1 });
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "succeeded" });
  });

  it("retries an error with exponential backoff, then fails it once the attempts are used up", async () => {
    const handlers = { "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(err("app.provider_down")) }) };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });

    expect(await run(handlers)).toMatchObject({ retried: 1 });
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "pending", attempts: 1, lastError: "app.provider_down", runAt: new Date(NOW.getTime() + 10 * SECOND_MS) });

    test.clock.advance(10 * SECOND_MS);
    expect(await run(handlers)).toMatchObject({ retried: 1 });
    expect(await getJob(test.ctx, id)).toMatchObject({ attempts: 2, runAt: new Date(NOW.getTime() + 30 * SECOND_MS) });

    test.clock.advance(20 * SECOND_MS);
    expect(await run(handlers)).toMatchObject({ failed: 1 });
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "failed", attempts: 3, lastError: "app.provider_down", finishedAt: new Date(NOW.getTime() + 30 * SECOND_MS) });
  });

  it("caps the backoff at the queue's maximum and shortens it by the jitter", async () => {
    const handlers = { "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(err("app.provider_down")) }) };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: "m-1" }, maxAttempts: 10 });
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await runDueJobs(test.ctx, { handlers, logger, random: () => 0.5 });
      const job = await getJob(test.ctx, id);
      test.clock.set(job?.runAt ?? NOW);
    }
    // Attempt 4 waits min(60, 10 * 2^3) = 60 seconds, less 10 % for random() = 0.5.
    const job = await getJob(test.ctx, id);
    const previous = new Date(NOW.getTime() + (9 + 18 + 36) * SECOND_MS);
    expect(job?.runAt).toEqual(new Date(previous.getTime() + 54 * SECOND_MS));
  });

  it("fails at once on failJob and waits the handler's own delay on retryJobLater", async () => {
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: ({ messageId }) => Promise.resolve(messageId === "m-1" ? failJob("app.message_gone") : retryJobLater("app.rate_limited", 120)),
      }),
    };
    const gone = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });
    const limited = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: "m-2" } });

    expect(await run(handlers)).toMatchObject({ failed: 1, retried: 1 });
    expect(await getJob(test.ctx, gone.id)).toMatchObject({ status: "failed", attempts: 1, lastError: "app.message_gone" });
    expect(await getJob(test.ctx, limited.id)).toMatchObject({ status: "pending", runAt: new Date(NOW.getTime() + 120 * SECOND_MS) });
  });

  it("fails a payload its handler's schema refuses without running it, logging paths only", async () => {
    const runHandler = vi.fn(() => Promise.resolve(ok()));
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: 42, secret: "do-not-log" } });

    expect(await run({ "ai.reply": defineJobHandler({ payload, run: runHandler }) })).toMatchObject({ failed: 1 });
    expect(runHandler).not.toHaveBeenCalled();
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "failed", attempts: 1, lastError: "jobs.invalid_payload" });
    expect(logger.lines).toEqual(["warn: job payload does not match its handler's schema; failed without running"]);
  });

  it("retries a handler that throws under jobs.handler_threw and logs it", async () => {
    const handlers = { "ai.reply": defineJobHandler({ payload, run: () => Promise.reject(new Error("socket hang up")) }) };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });

    expect(await run(handlers)).toMatchObject({ retried: 1 });
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "pending", lastError: "jobs.handler_threw" });
    expect(logger.lines).toEqual(["error: job handler threw"]);
  });

  it("treats a handler that returns no result like a throw", async () => {
    // @ts-expect-error: a JavaScript handler can return anything.
    const handlers = { "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(undefined) }) };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });
    await run(handlers);
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "pending", lastError: "jobs.handler_threw" });
  });

  it("refuses a handler for a queue the config does not define", async () => {
    const handlers = { "ai.unknown": defineJobHandler({ payload, run: () => Promise.resolve(ok()) }) };
    await expect(run(handlers)).rejects.toThrow('handlers for queues the config does not define: ai.unknown');
  });

  it("runs only the queues it has handlers for", async () => {
    await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });
    const handlers = { "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(ok()) }) };
    expect(await run(handlers)).toEqual({ succeeded: 0, retried: 0, failed: 0, stale: 0 });
  });
});

describe("leases and fencing", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("claims oldest due first, at most the limit, and not jobs already running", async () => {
    const first = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const second = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, delaySeconds: 1 });
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    const claimed = await claimJobs(test.ctx, { queue: "ai.reply", limit: 2, workerId: "worker-a" });
    expect(claimed.map((entry) => entry.job.id)).toEqual([first.id, second.id]);
    expect(claimed[0]?.job).toMatchObject({ status: "running", attempts: 1, lockedBy: "worker-a", lockedUntil: new Date(NOW.getTime() + 60 * SECOND_MS) });
    expect(await claimJobs(test.ctx, { queue: "ai.reply", limit: 5, workerId: "worker-b" })).toHaveLength(1);
  });

  it("takes over a job whose lease ended and refuses the first worker's late completion", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const [stale] = await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "worker-a" });
    if (stale === undefined) throw new Error("expected a claim");

    test.clock.advance(60 * SECOND_MS);
    const [fresh] = await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "worker-b" });
    expect(fresh?.job).toMatchObject({ id, attempts: 2, lockedBy: "worker-b" });

    expect(await completeJob(test.ctx, stale, { kind: "succeeded" })).toBe(false);
    expect(await extendJobLease(test.ctx, stale)).toBe(false);
    expect(await releaseJob(test.ctx, stale)).toBe(false);
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "running", lockedBy: "worker-b" });
  });

  it("fails a job whose lease ended with no attempts left", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });
    await claimJobs(test.ctx, { queue: "mail.send", limit: 1, workerId: "worker-a" });
    test.clock.advance(300 * SECOND_MS);
    expect(await claimJobs(test.ctx, { queue: "mail.send", limit: 1, workerId: "worker-b" })).toEqual([]);
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "failed", attempts: 1, lastError: "jobs.lease_expired", lockedBy: null });
  });

  it("extends the lease of a held job", async () => {
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const [claimed] = await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "worker-a" });
    if (claimed === undefined) throw new Error("expected a claim");
    test.clock.advance(50 * SECOND_MS);
    expect(await extendJobLease(test.ctx, claimed)).toBe(true);
    test.clock.advance(50 * SECOND_MS);
    expect(await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "worker-b" })).toEqual([]);
    expect(await getJob(test.ctx, claimed.job.id)).toMatchObject({ lockedUntil: new Date(NOW.getTime() + 110 * SECOND_MS) });
  });

  it("releases a held job with its attempt given back, due at once", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });
    const [claimed] = await claimJobs(test.ctx, { queue: "mail.send", limit: 1, workerId: "worker-a" });
    if (claimed === undefined) throw new Error("expected a claim");
    test.clock.advance(SECOND_MS);
    expect(await releaseJob(test.ctx, claimed)).toBe(true);
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "pending", attempts: 0, runAt: new Date(NOW.getTime() + SECOND_MS), lockedBy: null });
    expect(await completeJob(test.ctx, claimed, { kind: "succeeded" })).toBe(false);
  });
});
