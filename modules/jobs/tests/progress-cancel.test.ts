// Progress a running handler reports, and cancelling a running job (issue #951): stored and read back code-only,
// throttled, fenced by the claim; a cancel request reaches the handler through its signal and ends the job cancelled,
// whatever path the attempt takes (handler return, retry, lease end, release).
import { err, ok } from "@softure-ai/core";
import { defineJobHandler, isJobCancelled, JobCancelledError, type JobHandlers, type JobProgress } from "@softure-ai/jobs";
import {
  cancelJob,
  claimJobs,
  enqueueJob,
  getJob,
  heartbeatJob,
  listJobRuns,
  listRecentJobs,
  releaseJob,
  requestJobCancel,
  retryJob,
  type JobsLogger,
} from "@softure-ai/jobs/server";
import { recordJobHooks, runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

const payload = z.object({});

function createLogger(): JobsLogger & { lines: string[] } {
  const lines: string[] = [];
  const write = (level: string) => (message: string, fields?: Readonly<Record<string, unknown>>) =>
    lines.push(`${level}: ${message}${typeof fields?.paths === "string" ? ` (${fields.paths})` : ""}`);
  return { lines, info: write("info"), warn: write("warn"), error: write("error") };
}

describe("progress", () => {
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

  it("stores the reported progress, which getJob and listRecentJobs return while the job runs", async () => {
    const seen: unknown[] = [];
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async (_payload, { job, reportProgress }) => {
          await reportProgress({ step: "render.encode", done: 3, total: 10, code: "render.gpu" });
          const read = await getJob(test.ctx, job.id);
          const [listed] = await listRecentJobs(test.ctx, { statuses: ["running"] });
          seen.push(read?.progress, read?.progressAt, listed?.progress);
          return ok();
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    expect(await run(handlers)).toMatchObject({ succeeded: 1 });
    const progress = { step: "render.encode", done: 3, total: 10, code: "render.gpu" };
    expect(seen).toEqual([progress, NOW, progress]);
    // The finished job keeps the last progress its attempt reported.
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "succeeded", progress, progressAt: NOW });
  });

  it("writes at most once a second and writes the newest held report when the handler returns", async () => {
    const stored: unknown[] = [];
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async (_payload, { job, reportProgress }) => {
          await reportProgress({ step: "a" });
          await reportProgress({ step: "b" });
          await reportProgress({ step: "c" });
          stored.push((await getJob(test.ctx, job.id))?.progress);
          test.clock.advance(SECOND_MS);
          await reportProgress({ step: "d" });
          stored.push((await getJob(test.ctx, job.id))?.progress);
          await reportProgress({ step: "e" });
          return ok();
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    await run(handlers);
    expect(stored).toEqual([{ step: "a" }, { step: "d" }]);
    expect(await getJob(test.ctx, id)).toMatchObject({ progress: { step: "e" }, progressAt: new Date(NOW.getTime() + SECOND_MS) });
  });

  it("drops an invalid progress with a warning naming its paths, and the job still succeeds", async () => {
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async (_payload, { reportProgress }) => {
          await reportProgress({ step: "Rendering file.mp4", done: -1 });
          await reportProgress({ step: "render", note: "free text" } as unknown as JobProgress);
          return ok();
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    expect(await run(handlers)).toMatchObject({ succeeded: 1 });
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "succeeded", progress: null, progressAt: null });
    expect(logger.lines).toEqual([
      "warn: job progress does not match the progress schema; not stored (step, done)",
      "warn: job progress does not match the progress schema; not stored ((root))",
    ]);
  });

  it("starts every attempt without the previous attempt's progress", async () => {
    const seen: unknown[] = [];
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async (_payload, { job, reportProgress }) => {
          seen.push((await getJob(test.ctx, job.id))?.progress);
          await reportProgress({ step: "fetch", done: job.attempts });
          return job.attempts === 1 ? err("app.provider_down") : ok();
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    await run(handlers);
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "pending", progress: { step: "fetch", done: 1 } });
    test.clock.advance(10 * SECOND_MS);
    await run(handlers);
    expect(seen).toEqual([null, null]);
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "succeeded", progress: { step: "fetch", done: 2 } });
  });

  it("cannot be written by a worker whose job was taken over", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const [stale] = await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "w-1" });
    if (stale === undefined) throw new Error("expected a claim");
    test.clock.advance(61 * SECOND_MS);
    await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "w-2" });

    expect(await heartbeatJob(test.ctx, stale)).toBe("lost");
    expect(await getJob(test.ctx, id)).toMatchObject({ lockedBy: "w-2", progress: null });
  });
});

describe("cancelling a job", () => {
  let test: TestJobs;
  let logger: ReturnType<typeof createLogger>;

  beforeEach(async () => {
    test = await createTestJobs();
    logger = createLogger();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("cancels a pending job at once, like cancelJob", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    expect(await requestJobCancel(test.ctx, id)).toMatchObject({ ok: true, value: { status: "cancelled", finishedAt: NOW, cancelRequestedAt: null } });
  });

  it("refuses a finished job and an unknown id; cancelJob still refuses a running job", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "w-1" });
    expect(await cancelJob(test.ctx, id)).toEqual({ ok: false, error: "jobs.not_cancellable" });
    await cancelJob(test.ctx, (await enqueueJob(test.ctx, { queue: "mail.send", payload: {} })).id);

    const done = await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });
    await runDueJobs(test.ctx, { handlers: { "mail.send": defineJobHandler({ payload, run: () => Promise.resolve(ok()) }) }, logger });
    expect(await requestJobCancel(test.ctx, done.id)).toEqual({ ok: false, error: "jobs.not_cancellable" });
    expect(await requestJobCancel(test.ctx, "999")).toEqual({ ok: false, error: "jobs.not_found" });
    expect(await requestJobCancel(test.ctx, "nope")).toEqual({ ok: false, error: "jobs.not_found" });
  });

  it("marks a running job and keeps the first request's time", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const [claimed] = await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "w-1" });
    if (claimed === undefined) throw new Error("expected a claim");

    expect(await requestJobCancel(test.ctx, id)).toMatchObject({ ok: true, value: { status: "running", cancelRequestedAt: NOW } });
    test.clock.advance(SECOND_MS);
    expect(await requestJobCancel(test.ctx, id)).toMatchObject({ ok: true, value: { cancelRequestedAt: NOW } });
    expect(await heartbeatJob(test.ctx, claimed)).toBe("cancel_requested");
  });

  it("aborts the handler at its next progress write and ends the job cancelled, without onJobFailed", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs(recorder.options);
    let reason: unknown;
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async (_payload, { job, signal, reportProgress }) => {
          await requestJobCancel(test.ctx, job.id);
          await reportProgress({ step: "render" });
          reason = signal.reason;
          // A handler that ignores the abort and reports success still ends cancelled.
          return isJobCancelled(signal) ? ok() : err("app.not_aborted");
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    expect(await runDueJobs(test.ctx, { handlers, logger })).toEqual({ succeeded: 0, retried: 0, failed: 0, cancelled: 1, stale: 0 });
    expect(reason).toBeInstanceOf(JobCancelledError);
    expect(reason).toMatchObject({ name: "AbortError", code: "jobs.cancelled" });
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "cancelled", finishedAt: NOW, lockedBy: null, cancelRequestedAt: NOW, lastError: null });
    expect(await listJobRuns(test.ctx)).toMatchObject([{ jobId: id, attempt: 1, outcome: "cancelled", errorCode: "jobs.cancelled", startedAt: NOW, finishedAt: NOW }]);
    expect(recorder.failedJobs).toEqual([]);
  });

  it("does not log a handler that throws because of the cancel abort", async () => {
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async (_payload, { job, signal, reportProgress }) => {
          await requestJobCancel(test.ctx, job.id);
          await reportProgress({ step: "render" });
          throw signal.reason;
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    expect(await runDueJobs(test.ctx, { handlers, logger })).toMatchObject({ cancelled: 1 });
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "cancelled" });
    expect(logger.lines).toEqual([]);
  });

  it("ends cancelled instead of retrying when the request came before the attempt failed", async () => {
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async (_payload, { job }) => {
          await requestJobCancel(test.ctx, job.id);
          return err("app.provider_down");
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    expect(await runDueJobs(test.ctx, { handlers, logger })).toMatchObject({ cancelled: 1, retried: 0 });
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "cancelled", attempts: 1 });
  });

  it("keeps the outcome of an attempt that succeeded before its worker saw the request", async () => {
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async (_payload, { job }) => {
          await requestJobCancel(test.ctx, job.id);
          return ok();
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    expect(await runDueJobs(test.ctx, { handlers, logger })).toMatchObject({ succeeded: 1 });
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "succeeded", cancelRequestedAt: null });
  });

  it("cancels a requested job whose lease ended instead of running it again or failing it", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, maxAttempts: 1 });
    await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "w-1" });
    await requestJobCancel(test.ctx, id);
    test.clock.advance(61 * SECOND_MS);

    expect(await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "w-2" })).toEqual([]);
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "cancelled", lockedBy: null, lastError: null });
    expect(await listJobRuns(test.ctx)).toMatchObject([{ jobId: id, outcome: "cancelled", errorCode: "jobs.cancelled", startedAt: null }]);
  });

  it("cancels a requested job its stopping worker releases", async () => {
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const [claimed] = await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "w-1" });
    if (claimed === undefined) throw new Error("expected a claim");
    await requestJobCancel(test.ctx, id);

    expect(await releaseJob(test.ctx, claimed)).toBe(true);
    expect(await getJob(test.ctx, id)).toMatchObject({ status: "cancelled", attempts: 1 });
    expect(await listJobRuns(test.ctx)).toMatchObject([{ outcome: "cancelled" }]);
  });

  it("runs a cancelled job again from scratch, without the request or the progress", async () => {
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async (_payload, { job, reportProgress }) => {
          await requestJobCancel(test.ctx, job.id);
          await reportProgress({ step: "render" });
          return ok();
        },
      }),
    };
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    await runDueJobs(test.ctx, { handlers, logger });

    expect(await retryJob(test.ctx, id)).toMatchObject({ ok: true, value: { status: "pending", attempts: 0, cancelRequestedAt: null, progress: null, progressAt: null } });
  });
});
