// `onJobAttempt`: one event per recorded attempt with its outcome, code and duration, the same classification the
// worker records; a throwing hook is logged and harmless.
import { err, ok } from "@softure-ai/core";
import { defineJobHandler, failJob, pauseQueueLater, type JobHandlers } from "@softure-ai/jobs";
import { enqueueJob, type JobsLogger } from "@softure-ai/jobs/server";
import { listJobs, recordJobHooks, runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig, createTestJobs, NOW, QUEUES, SECOND_MS, type TestJobs } from "./support.js";

const silentLogger: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function handlerRunning(run: () => Promise<unknown>): JobHandlers[string] {
  return defineJobHandler({ payload: z.object({}).passthrough(), run: run as never });
}

describe("onJobAttempt", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("reports a succeeded attempt with its origin and duration", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ ...recorder.options });
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: { secret: "s3cr3t" } });
    const handler = handlerRunning(() => {
      test.clock.advance(250);
      return Promise.resolve(ok());
    });

    await runDueJobs(test.ctx, { handlers: { "ai.reply": handler }, logger: silentLogger });

    expect(recorder.attempts).toEqual([
      { queue: "ai.reply", jobId: id, origin: "app", attempt: 1, maxAttempts: 3, outcome: "succeeded", code: null, durationMs: 250, at: new Date(NOW.getTime() + 250) },
    ]);
  });

  it("reports every retried attempt and the final failure, with the code", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ ...recorder.options });
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const handlers = { "ai.reply": handlerRunning(() => Promise.resolve(err("app.timeout"))) };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await runDueJobs(test.ctx, { handlers, logger: silentLogger, random: () => 0 });
      test.clock.advance(60 * SECOND_MS);
    }

    expect(recorder.attempts.map(({ jobId, attempt, outcome, code }) => ({ jobId, attempt, outcome, code }))).toEqual([
      { jobId: id, attempt: 1, outcome: "retried", code: "app.timeout" },
      { jobId: id, attempt: 2, outcome: "retried", code: "app.timeout" },
      { jobId: id, attempt: 3, outcome: "failed", code: "app.timeout" },
    ]);
    expect(recorder.failedJobs).toHaveLength(1);
  });

  it("reports failJob, a throw and an invalid payload with the codes the worker records", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ queues: { ...QUEUES, "app.strict": {} }, ...recorder.options });
    const failed = await enqueueJob(test.ctx, { queue: "mail.send", payload: { kind: "fail" } });
    const thrown = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const invalid = await enqueueJob(test.ctx, { queue: "app.strict", payload: { to: 42 } });
    const handlers = {
      "mail.send": handlerRunning(() => Promise.resolve(failJob("app.bounced"))),
      "ai.reply": handlerRunning(() => Promise.reject(new Error("boom"))),
      "app.strict": defineJobHandler({ payload: z.object({ to: z.string() }), run: () => Promise.resolve(ok()) }),
    };

    await runDueJobs(test.ctx, { handlers, logger: silentLogger, random: () => 0 });

    const byJob = Object.fromEntries(recorder.attempts.map((event) => [event.jobId, { outcome: event.outcome, code: event.code }]));
    expect(byJob).toEqual({
      [failed.id]: { outcome: "failed", code: "app.bounced" },
      [thrown.id]: { outcome: "retried", code: "jobs.handler_threw" },
      [invalid.id]: { outcome: "failed", code: "jobs.invalid_payload" },
    });
  });

  it("reports a pauseQueueLater as paused, the attempt given back", async () => {
    const recorder = recordJobHooks();
    test = await createTestJobs({ ...recorder.options });
    const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });

    await runDueJobs(test.ctx, { handlers: { "ai.reply": handlerRunning(() => Promise.resolve(pauseQueueLater("app.rate_limited", 60))) }, logger: silentLogger });

    expect(recorder.attempts).toMatchObject([{ jobId: id, attempt: 1, outcome: "paused", code: "app.rate_limited" }]);
    expect(recorder.pausedQueues).toHaveLength(1);
  });

  it("logs a throwing hook by kind and keeps the job's outcome", async () => {
    const errors: { message: string; fields: unknown }[] = [];
    const logger: JobsLogger = { info: () => undefined, warn: () => undefined, error: (message, fields) => errors.push({ message, fields }) };
    test = await createTestJobs({
      onJobAttempt: () => {
        throw new Error("metrics down: token=hunter2");
      },
    });
    const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });

    const report = await runDueJobs(test.ctx, { handlers: { "mail.send": handlerRunning(() => Promise.resolve(ok())) }, logger });

    expect(report).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(await listJobs(test.database.db)).toMatchObject([{ id, status: "succeeded" }]);
    expect(errors).toMatchObject([{ message: "the onJobAttempt hook failed", fields: { queue: "mail.send", jobId: id, outcome: "succeeded" } }]);
  });
});

describe("onJobAttempt option", () => {
  it("is refused at config load when it is not a function", () => {
    expect(() => createConfig({ onJobAttempt: "count me" as never })).toThrow(/onJobAttempt/);
  });
});
