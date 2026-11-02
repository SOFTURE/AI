// Queue pacing and pauses: a rate limit shared by every claim, an operator's pause and resume, the circuit breaker
// (trip, growth, cap, reset, counted codes), a handler's `pauseQueueLater` and the `onQueuePaused` hook.
import { err, ok, type ErrorCode } from "@softure-ai/core";
import { defineJobHandler, failJob, jobs, pauseQueueLater, type JobFailure, type JobHandlers, type JobsOptionsInput } from "@softure-ai/jobs";
import {
  claimJobs,
  completeJob,
  enqueueJob,
  getJobsOptions,
  getQueuePause,
  getQueueStats,
  pauseQueue,
  resumeQueue,
  runClaimedJob,
  type JobsLogger,
} from "@softure-ai/jobs/server";
import { listJobs, listRunHistory, recordJobHooks, runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig, createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

const QUEUE = "feed.fetch";
const silentLogger: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const NEVER_ABORTED = new AbortController().signal;

type Outcome = ErrorCode | "ok" | JobFailure;

/** A handler that returns the queued outcomes in turn, then `ok()`. */
function scriptedHandler(outcomes: Outcome[]): JobHandlers {
  return {
    [QUEUE]: defineJobHandler({
      payload: z.object({}).passthrough(),
      run: () => {
        const next = outcomes.shift() ?? "ok";
        if (next === "ok") return Promise.resolve(ok());
        return Promise.resolve(typeof next === "string" ? err(next) : next);
      },
    }),
  };
}

function queueOptions(extra: Record<string, unknown>): JobsOptionsInput["queues"] {
  return { [QUEUE]: { maxAttempts: 10, backoff: { baseSeconds: 1, maxSeconds: 1 }, concurrency: 5, ...extra } };
}

async function enqueueMany(test: TestJobs, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) ids.push((await enqueueJob(test.ctx, { queue: QUEUE, payload: { index } })).id);
  return ids;
}

async function claim(test: TestJobs, options: { limit?: number; workerId?: string; random?: () => number } = {}) {
  return claimJobs(test.ctx, { queue: QUEUE, limit: options.limit ?? 5, workerId: options.workerId ?? "worker-a", logger: silentLogger, random: options.random ?? (() => 0) });
}

describe("queue options", () => {
  it("defaults maxPauseSeconds to 16 times pauseSeconds, at most a week", () => {
    const options = getJobsOptions(createConfig({ queues: queueOptions({ breaker: { failures: 3, pauseSeconds: 60 } }) }));
    expect(options.queues[QUEUE]?.breaker).toEqual({ failures: 3, pauseSeconds: 60, maxPauseSeconds: 960 });
    const long = getJobsOptions(createConfig({ queues: queueOptions({ breaker: { failures: 3, pauseSeconds: 86_400 } }) }));
    expect(long.queues[QUEUE]?.breaker?.maxPauseSeconds).toBe(7 * 86_400);
  });

  it("refuses a maxPauseSeconds below pauseSeconds, a mixed rate limit and an invalid code", () => {
    expect(() => jobs({ queues: queueOptions({ breaker: { failures: 3, pauseSeconds: 60, maxPauseSeconds: 30 } }) })).toThrow("maxPauseSeconds must be at least pauseSeconds");
    expect(() => jobs({ queues: queueOptions({ rateLimit: { minGapMs: 1000, max: 5 } }) })).toThrow();
    expect(() => jobs({ queues: queueOptions({ breaker: { failures: 1, pauseSeconds: 60, codes: ["no-namespace"] } }) })).toThrow("must be error codes");
  });

  it("refuses pauseQueueLater seconds that are not a finite number above 0", () => {
    expect(() => pauseQueueLater("app.captcha", 0)).toThrow(RangeError);
    expect(() => pauseQueueLater("app.captcha", Number.NaN)).toThrow(RangeError);
  });
});

describe("rateLimit", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("claims one job per minimum gap, across workers, and leaves the others their attempts", async () => {
    test = await createTestJobs({ queues: queueOptions({ rateLimit: { minGapMs: 10_000 } }) });
    await enqueueMany(test, 3);

    expect(await claim(test)).toHaveLength(1);
    expect(await claim(test, { workerId: "worker-b" })).toEqual([]);
    test.clock.advance(9 * SECOND_MS);
    expect(await claim(test, { workerId: "worker-b" })).toEqual([]);
    test.clock.advance(SECOND_MS);
    expect(await claim(test, { workerId: "worker-b" })).toHaveLength(1);

    expect((await listJobs(test.database.db)).map((job) => [job.status, job.attempts])).toEqual([
      ["running", 1],
      ["running", 1],
      ["pending", 0],
    ]);
  });

  it("adds the jitter to the gap", async () => {
    test = await createTestJobs({ queues: queueOptions({ rateLimit: { minGapMs: 10_000, jitterMs: 4000 } }) });
    await enqueueMany(test, 2);

    expect(await claim(test, { random: () => 0.5 })).toHaveLength(1);
    test.clock.advance(11_999);
    expect(await claim(test)).toEqual([]);
    test.clock.advance(1);
    expect(await claim(test)).toHaveLength(1);
  });

  it("claims at most max jobs per window", async () => {
    test = await createTestJobs({ queues: queueOptions({ rateLimit: { max: 2, perSeconds: 60 } }) });
    await enqueueMany(test, 5);

    expect(await claim(test, { limit: 5 })).toHaveLength(2);
    test.clock.advance(30 * SECOND_MS);
    expect(await claim(test, { limit: 5 })).toEqual([]);
    test.clock.advance(30 * SECOND_MS);
    expect(await claim(test, { limit: 1 })).toHaveLength(1);
    expect(await claim(test, { limit: 5 })).toHaveLength(1);
    expect(await claim(test, { limit: 5 })).toEqual([]);
  });
});

describe("pauseQueue and resumeQueue", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("claims nothing while an operator's pause lasts, keeps the attempts, and claims again after resumeQueue", async () => {
    test = await createTestJobs({ queues: queueOptions({}) });
    await enqueueMany(test, 2);

    expect(await pauseQueue(test.ctx, QUEUE, { reason: "provider maintenance" })).toEqual({
      ok: true,
      value: { source: "operator", reason: "provider maintenance", until: null },
    });
    test.clock.advance(3600 * SECOND_MS);
    expect(await claim(test)).toEqual([]);
    expect(await getQueuePause(test.ctx, QUEUE)).toEqual({ source: "operator", reason: "provider maintenance", until: null });
    expect((await listJobs(test.database.db)).map((job) => job.attempts)).toEqual([0, 0]);

    expect(await resumeQueue(test.ctx, QUEUE)).toEqual({ ok: true, value: null });
    expect(await getQueuePause(test.ctx, QUEUE)).toBeNull();
    expect(await claim(test)).toHaveLength(2);
  });

  it("ends a pause with an end by itself, also for a paced queue", async () => {
    test = await createTestJobs({ queues: queueOptions({ rateLimit: { max: 10, perSeconds: 60 } }) });
    await enqueueMany(test, 1);
    await pauseQueue(test.ctx, QUEUE, { reason: "app.maintenance", until: new Date(NOW.getTime() + 60 * SECOND_MS) });

    test.clock.advance(59 * SECOND_MS);
    expect(await claim(test)).toEqual([]);
    test.clock.advance(SECOND_MS);
    expect(await getQueuePause(test.ctx, QUEUE)).toBeNull();
    expect(await claim(test)).toHaveLength(1);
  });

  it("refuses a queue the configuration does not define and an empty reason", async () => {
    test = await createTestJobs({ queues: queueOptions({}) });
    expect(await pauseQueue(test.ctx, "nobody.here", { reason: "x" })).toEqual({ ok: false, error: "jobs.unknown_queue" });
    expect(await resumeQueue(test.ctx, "nobody.here")).toEqual({ ok: false, error: "jobs.unknown_queue" });
    await expect(pauseQueue(test.ctx, QUEUE, { reason: "" })).rejects.toThrow(RangeError);
  });

  it("shows the pause and the breaker's counter in getQueueStats", async () => {
    test = await createTestJobs({ queues: queueOptions({ breaker: { failures: 5, pauseSeconds: 60 } }) });
    await enqueueMany(test, 1);
    await runDueJobs(test.ctx, { handlers: scriptedHandler(["app.rate_limited"]), logger: silentLogger, random: () => 0 });
    await pauseQueue(test.ctx, QUEUE, { reason: "app.manual", until: new Date(NOW.getTime() + 60 * SECOND_MS) });

    const [stats] = await getQueueStats(test.ctx);
    expect(stats).toMatchObject({ queue: QUEUE, pause: { source: "operator", reason: "app.manual", until: new Date(NOW.getTime() + 60 * SECOND_MS) }, consecutiveFailures: 1 });
    test.clock.advance(60 * SECOND_MS);
    expect((await getQueueStats(test.ctx))[0]).toMatchObject({ pause: null, consecutiveFailures: 1 });
  });
});

describe("breaker", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("pauses after N failures in a row, doubles the pause when the first run after it fails, caps it and resets on success", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ queues: queueOptions({ breaker: { failures: 3, pauseSeconds: 60, maxPauseSeconds: 200 } }), ...recorder.options });
    await enqueueMany(test, 3);
    const outcomes: Outcome[] = ["app.rate_limited", "app.rate_limited", "app.rate_limited", "app.rate_limited", "app.rate_limited"];
    const handlers = scriptedHandler(outcomes);
    const run = () => runDueJobs(test.ctx, { handlers, logger: silentLogger, random: () => 0 });
    const at = (seconds: number) => new Date(NOW.getTime() + seconds * SECOND_MS);

    expect(await run()).toMatchObject({ retried: 3 });
    expect(recorder.pausedQueues).toEqual([{ queue: QUEUE, code: "app.rate_limited", until: at(60), source: "breaker", at: NOW }]);

    test.clock.advance(30 * SECOND_MS);
    expect(await run()).toMatchObject({ succeeded: 0, retried: 0 });

    test.clock.advance(30 * SECOND_MS);
    expect(await run()).toMatchObject({ retried: 1 });
    expect(recorder.pausedQueues.at(-1)).toMatchObject({ until: at(60 + 120) });

    test.clock.advance(120 * SECOND_MS);
    expect(await run()).toMatchObject({ retried: 1 });
    expect(recorder.pausedQueues.at(-1)).toMatchObject({ until: at(180 + 200) });

    test.clock.advance(200 * SECOND_MS);
    expect(await run()).toMatchObject({ succeeded: 3, retried: 0 });
    expect(recorder.pausedQueues).toHaveLength(3);
    expect((await getQueueStats(test.ctx))[0]).toMatchObject({ pause: null, consecutiveFailures: 0 });
    expect((await listJobs(test.database.db)).map((job) => [job.status, job.attempts])).toEqual([
      ["succeeded", 3],
      ["succeeded", 3],
      ["succeeded", 2],
    ]);
  });

  it("starts a fresh count after a success: failures that are not in a row do not trip it", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ queues: queueOptions({ breaker: { failures: 2, pauseSeconds: 60 } }), ...recorder.options });
    await enqueueMany(test, 4);
    await runDueJobs(test.ctx, { handlers: scriptedHandler(["app.rate_limited", "ok", "app.rate_limited", "ok"]), logger: silentLogger, random: () => 0 });
    expect(recorder.pausedQueues).toEqual([]);
  });

  it("does not count failJob, an invalid payload, or a code outside codes", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ queues: queueOptions({ breaker: { failures: 1, pauseSeconds: 60, codes: ["app.rate_limited"] } }), ...recorder.options });
    await enqueueMany(test, 2);
    const strict = { [QUEUE]: defineJobHandler({ payload: z.object({ index: z.number() }), run: () => Promise.resolve(failJob("app.gone")) }) };
    await runDueJobs(test.ctx, { handlers: strict, logger: silentLogger, random: () => 0 });
    await enqueueJob(test.ctx, { queue: QUEUE, payload: { index: "not a number" } });
    await runDueJobs(test.ctx, { handlers: strict, logger: silentLogger, random: () => 0 });
    await enqueueMany(test, 1);
    await runDueJobs(test.ctx, { handlers: scriptedHandler(["app.other"]), logger: silentLogger, random: () => 0 });
    expect(recorder.pausedQueues).toEqual([]);
    expect((await getQueueStats(test.ctx))[0]).toMatchObject({ consecutiveFailures: 0 });

    await enqueueMany(test, 1);
    test.clock.advance(SECOND_MS);
    await runDueJobs(test.ctx, { handlers: scriptedHandler(["app.rate_limited", "app.rate_limited"]), logger: silentLogger, random: () => 0 });
    expect(recorder.pausedQueues).toEqual([{ queue: QUEUE, code: "app.rate_limited", until: new Date(NOW.getTime() + 61 * SECOND_MS), source: "breaker", at: new Date(NOW.getTime() + SECOND_MS) }]);
  });

  it("only counts failures of jobs that were running when the queue paused", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ queues: queueOptions({ breaker: { failures: 1, pauseSeconds: 60 } }), ...recorder.options });
    await enqueueMany(test, 2);
    const [first, second] = await claim(test, { limit: 2 });
    if (first === undefined || second === undefined) throw new Error("expected two claimed jobs");

    test.clock.advance(SECOND_MS);
    await completeJob(test.ctx, first, { kind: "retry", error: "app.rate_limited", runAt: test.clock.now() });
    test.clock.advance(SECOND_MS);
    await completeJob(test.ctx, second, { kind: "retry", error: "app.rate_limited", runAt: test.clock.now() });

    expect(recorder.pausedQueues).toHaveLength(1);
    expect(await getQueuePause(test.ctx, QUEUE)).toEqual({ source: "breaker", reason: "app.rate_limited", until: new Date(NOW.getTime() + 61 * SECOND_MS) });
    expect((await getQueueStats(test.ctx))[0]).toMatchObject({ consecutiveFailures: 2 });
  });
});

describe("pauseQueueLater", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("pauses the queue, gives the job its attempt back, due when the pause ends, and records the run as retried", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ queues: queueOptions({}), ...recorder.options });
    const [id] = await enqueueMany(test, 2);

    expect(await runDueJobs(test.ctx, { handlers: scriptedHandler([pauseQueueLater("app.captcha", 300)]), logger: silentLogger })).toMatchObject({ retried: 1, succeeded: 0 });

    const until = new Date(NOW.getTime() + 300 * SECOND_MS);
    expect((await listJobs(test.database.db)).map((job) => [job.id, job.status, job.attempts, job.lastError, job.runAt])).toEqual([
      [id, "pending", 0, "app.captcha", until],
      [expect.any(String), "pending", 0, null, NOW],
    ]);
    expect((await listRunHistory(test.database.db)).map((run) => [run.jobId, run.outcome, run.attempt, run.errorCode])).toEqual([[id, "retried", 1, "app.captcha"]]);
    expect(await getQueuePause(test.ctx, QUEUE)).toEqual({ source: "handler", reason: "app.captcha", until });
    expect(recorder.pausedQueues).toEqual([{ queue: QUEUE, code: "app.captcha", until, source: "handler", at: NOW }]);

    test.clock.advance(300 * SECOND_MS);
    expect(await runDueJobs(test.ctx, { handlers: scriptedHandler([]), logger: silentLogger })).toMatchObject({ succeeded: 2 });
  });

  it("never shortens a longer pause", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ queues: queueOptions({}), ...recorder.options });
    await enqueueMany(test, 2);
    const [first, second] = await claim(test, { limit: 2 });
    if (first === undefined || second === undefined) throw new Error("expected two claimed jobs");
    const options = { logger: silentLogger, signal: NEVER_ABORTED, random: () => 0 };

    await runClaimedJob(test.ctx, first, { ...options, handlers: scriptedHandler([pauseQueueLater("app.captcha", 300)]) });
    await runClaimedJob(test.ctx, second, { ...options, handlers: scriptedHandler([pauseQueueLater("app.captcha", 100)]) });

    expect(await getQueuePause(test.ctx, QUEUE)).toMatchObject({ until: new Date(NOW.getTime() + 300 * SECOND_MS) });
    expect(recorder.pausedQueues).toHaveLength(1);
  });

  it("logs a throwing onQueuePaused hook and still records the pause", async () => {
    const errors: string[] = [];
    const logger: JobsLogger = { info: () => undefined, warn: () => undefined, error: (message) => errors.push(message) };
    test = await createTestJobs({
      queues: queueOptions({}),
      onQueuePaused: () => {
        throw new Error("mail down");
      },
    });
    await enqueueMany(test, 1);
    expect(await runDueJobs(test.ctx, { handlers: scriptedHandler([pauseQueueLater("app.captcha", 60)]), logger })).toMatchObject({ retried: 1 });
    expect(errors).toEqual(["the onQueuePaused hook failed"]);
    expect(await getQueuePause(test.ctx, QUEUE)).toMatchObject({ source: "handler" });
  });
});
