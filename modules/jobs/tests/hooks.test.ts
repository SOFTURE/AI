// Alert hooks: `onJobFailed` once per terminal failure, `onScheduleStateChanged` once per health transition, a
// throwing hook logged and harmless, and the test helper that records both.
import { err, ok, type ErrorCode, type Ok } from "@softure-ai/core";
import { defineJobHandler, failJob, jobSchedulesTable, type JobFailure, type JobHandlers, type JobsOptionsInput } from "@softure-ai/jobs";
import { checkScheduleStates, claimJobs, enqueueJob, type JobsLogger } from "@softure-ai/jobs/server";
import { listJobs, recordJobHooks, runDueJobs } from "@softure-ai/jobs/testing";
import { runJobWorker } from "@softure-ai/jobs/worker";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig, createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

const HOUR_MS = 60 * 60 * 1000;
const SCHEDULES = { "app.sync": { every: "1h" } } satisfies JobsOptionsInput["schedules"];

const silentLogger: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function recordingLogger(): { errors: { message: string; fields: unknown }[]; logger: JobsLogger } {
  const errors: { message: string; fields: unknown }[] = [];
  return {
    errors,
    logger: { info: () => undefined, warn: () => undefined, error: (message, fields) => errors.push({ message, fields }) },
  };
}

function handlerReturning(result: () => Promise<Ok<unknown> | JobFailure>): JobHandlers[string] {
  return defineJobHandler({ payload: z.object({}).passthrough(), run: () => result() });
}

/** A handler whose outcome the test switches between runs. */
function switchableHandler(): { setFailing: (code: ErrorCode | null) => void; handler: JobHandlers[string] } {
  let failure: ErrorCode | null = null;
  return {
    setFailing: (code) => {
      failure = code;
    },
    handler: handlerReturning(() => Promise.resolve(failure === null ? ok() : failJob(failure))),
  };
}

describe("onJobFailed", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("runs once when a handler fails the job for good, with codes and ids only", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ ...recorder.options });
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { secret: "s3cr3t" } });

    const report = await runDueJobs(test.ctx, {
      handlers: { "ai.reply": handlerReturning(() => Promise.resolve(failJob("app.upstream_gone"))) },
      logger: silentLogger,
    });

    expect(report).toEqual({ succeeded: 0, retried: 0, failed: 1, stale: 0 });
    expect(recorder.failedJobs).toEqual([{ queue: "ai.reply", jobId: id, code: "app.upstream_gone", attempts: 1, at: NOW }]);
  });

  it("runs once the attempts are used up, not on the retried attempts", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ ...recorder.options });
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const handlers = { "ai.reply": handlerReturning(() => Promise.resolve(err("app.timeout"))) };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await runDueJobs(test.ctx, { handlers, logger: silentLogger, random: () => 0 });
      if (attempt < 3) expect(recorder.failedJobs).toEqual([]);
      test.clock.advance(60 * SECOND_MS);
    }

    expect(recorder.failedJobs).toEqual([{ queue: "ai.reply", jobId: id, code: "app.timeout", attempts: 3, at: new Date(NOW.getTime() + 120 * SECOND_MS) }]);
  });

  it("runs for a payload that does not match the handler's schema", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ ...recorder.options });
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: { to: 42 } });
    const handler = defineJobHandler({ payload: z.object({ to: z.string() }), run: () => Promise.resolve(ok()) });

    await runDueJobs(test.ctx, { handlers: { "mail.send": handler }, logger: silentLogger });

    expect(recorder.failedJobs).toEqual([{ queue: "mail.send", jobId: id, code: "jobs.invalid_payload", attempts: 1, at: NOW }]);
  });

  it("runs for a job whose lease ended with no attempts left", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ ...recorder.options });
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });
    await claimJobs(test.ctx, { queue: "mail.send", limit: 1, workerId: "worker-a" });
    test.clock.advance(300 * SECOND_MS);

    await claimJobs(test.ctx, { queue: "mail.send", limit: 1, workerId: "worker-b" });
    await claimJobs(test.ctx, { queue: "mail.send", limit: 1, workerId: "worker-c" });

    expect(recorder.failedJobs).toEqual([
      { queue: "mail.send", jobId: id, code: "jobs.lease_expired", attempts: 1, at: new Date(NOW.getTime() + 300 * SECOND_MS) },
    ]);
  });

  it("does not run for a success", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ ...recorder.options });
    await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });

    await runDueJobs(test.ctx, { handlers: { "mail.send": handlerReturning(() => Promise.resolve(ok())) }, logger: silentLogger });

    expect(recorder.failedJobs).toEqual([]);
  });

  it("logs a throwing hook by kind and keeps the job's outcome", async () => {
    const { errors, logger } = recordingLogger();
    test = await createTestJobs({
      onJobFailed: () => {
        throw new Error("smtp down: password=hunter2");
      },
    });
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });

    const report = await runDueJobs(test.ctx, { handlers: { "mail.send": handlerReturning(() => Promise.resolve(failJob("app.bounced"))) }, logger });

    expect(report).toEqual({ succeeded: 0, retried: 0, failed: 1, stale: 0 });
    expect(await listJobs(test.database.db)).toMatchObject([{ id, status: "failed", lastError: "app.bounced" }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ message: "the onJobFailed hook failed", fields: { queue: "mail.send", jobId: id } });
  });
});

describe("hook options", () => {
  it("refuse a hook that is not a function at config load", () => {
    expect(() => createConfig({ onJobFailed: "mail me" as never })).toThrow(/onJobFailed/);
    expect(() => createConfig({ onScheduleStateChanged: 1 as never })).toThrow(/onScheduleStateChanged/);
  });
});

describe("onScheduleStateChanged", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("reports failing once, then the recovery", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ schedules: SCHEDULES, ...recorder.options });
    const { setFailing, handler } = switchableHandler();
    const handlers = { "app.sync": handler };

    setFailing("app.provider_down");
    await runDueJobs(test.ctx, { handlers, logger: silentLogger });
    test.clock.advance(HOUR_MS);
    await runDueJobs(test.ctx, { handlers, logger: silentLogger });
    expect(recorder.scheduleStateChanges).toEqual([{ queue: "app.sync", state: "failing", lastFailureCode: "app.provider_down", at: NOW }]);

    setFailing(null);
    test.clock.advance(HOUR_MS);
    await runDueJobs(test.ctx, { handlers, logger: silentLogger });

    expect(recorder.scheduleStateChanges).toEqual([
      { queue: "app.sync", state: "failing", lastFailureCode: "app.provider_down", at: NOW },
      { queue: "app.sync", state: "healthy", lastFailureCode: "app.provider_down", at: new Date(NOW.getTime() + 2 * HOUR_MS) },
    ]);
    expect(recorder.failedJobs).toHaveLength(2);
  });

  it("reports late when no run succeeded for two periods, and healthy after the next success", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ schedules: SCHEDULES, ...recorder.options });
    const { handler } = switchableHandler();
    await runDueJobs(test.ctx, { handlers: { "app.sync": handler }, logger: silentLogger });

    // No worker runs the queue for a while: the check alone sees the schedule turn late.
    test.clock.advance(2 * HOUR_MS);
    await checkScheduleStates(test.ctx);
    expect(recorder.scheduleStateChanges).toEqual([]);
    test.clock.advance(1);
    await checkScheduleStates(test.ctx);
    await checkScheduleStates(test.ctx);
    const lateAt = new Date(NOW.getTime() + 2 * HOUR_MS + 1);
    expect(recorder.scheduleStateChanges).toEqual([{ queue: "app.sync", state: "late", lastFailureCode: null, at: lateAt }]);

    await runDueJobs(test.ctx, { handlers: { "app.sync": handler }, logger: silentLogger });
    expect(recorder.scheduleStateChanges.at(-1)).toEqual({ queue: "app.sync", state: "healthy", lastFailureCode: null, at: lateAt });
  });

  it("reports a transition once when two checks race for it", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ schedules: SCHEDULES, ...recorder.options });
    await runDueJobs(test.ctx, { handlers: { "app.sync": handlerReturning(() => Promise.resolve(failJob("app.down"))) }, logger: silentLogger });
    recorder.scheduleStateChanges.length = 0;
    await test.database.db.update(jobSchedulesTable).set({ reportedState: "healthy" });

    const reported = await Promise.all([checkScheduleStates(test.ctx), checkScheduleStates(test.ctx)]);

    expect(reported.flat()).toEqual(["app.sync"]);
    expect(recorder.scheduleStateChanges).toEqual([{ queue: "app.sync", state: "failing", lastFailureCode: "app.down", at: NOW }]);
  });

  it("skips a schedule no worker has enqueued yet, and writes nothing without a hook", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ schedules: SCHEDULES, ...recorder.options });
    expect(await checkScheduleStates(test.ctx)).toEqual([]);
    await test.database.close();

    test = await createTestJobs({ schedules: SCHEDULES });
    await runDueJobs(test.ctx, { handlers: { "app.sync": handlerReturning(() => Promise.resolve(failJob("app.down"))) }, logger: silentLogger });
    expect(await checkScheduleStates(test.ctx)).toEqual([]);
    expect(await test.database.db.select({ reportedState: jobSchedulesTable.reportedState }).from(jobSchedulesTable)).toEqual([{ reportedState: "healthy" }]);
  });

  it("logs a throwing hook and keeps the reported state", async () => {
    const { errors, logger } = recordingLogger();
    test = await createTestJobs({
      schedules: SCHEDULES,
      onScheduleStateChanged: () => Promise.reject(new Error("mail failed")),
    });

    const report = await runDueJobs(test.ctx, { handlers: { "app.sync": handlerReturning(() => Promise.resolve(failJob("app.down"))) }, logger });

    expect(report.failed).toBe(1);
    expect(errors).toEqual([{ message: "the onScheduleStateChanged hook failed", fields: expect.objectContaining({ queue: "app.sync", state: "failing" }) as unknown }]);
    expect(await checkScheduleStates(test.ctx, { logger })).toEqual([]);
  });

  it("is checked by the worker", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ schedules: SCHEDULES, pollIntervalMs: 50, ...recorder.options });
    const controller = new AbortController();
    const worker = runJobWorker({
      db: test.database.db,
      config: test.ctx.config,
      handlers: { "app.sync": handlerReturning(() => Promise.resolve(failJob("app.down"))) },
      signal: controller.signal,
      logger: silentLogger,
      clock: test.clock,
    });
    const waitFor = async (isDone: () => boolean) => {
      const deadline = Date.now() + 5000;
      while (!isDone() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    };

    await waitFor(() => recorder.failedJobs.length > 0);
    // The first round's check ran before the job failed; the next one is due a minute later.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(recorder.scheduleStateChanges).toEqual([]);
    test.clock.advance(60 * SECOND_MS);
    await waitFor(() => recorder.scheduleStateChanges.length > 0);
    controller.abort();
    await worker;

    expect(recorder.failedJobs).toMatchObject([{ queue: "app.sync", code: "app.down" }]);
    expect(recorder.scheduleStateChanges).toMatchObject([{ queue: "app.sync", state: "failing", lastFailureCode: "app.down" }]);
  });
});
