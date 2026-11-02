// The line each recorded attempt leaves in the log (issue #934): succeeded, retried and failed with codes and ids
// only, none for a stale write, and the `logRuns` option.
import { err, ok } from "@softure-ai/core";
import { defineJobHandler, failJob, type JobHandlers, type JobsOptionsInput } from "@softure-ai/jobs";
import { claimJobs, enqueueJob, type JobsLogFields, type JobsLogger } from "@softure-ai/jobs/server";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

interface LoggedLine {
  readonly level: string;
  readonly message: string;
  readonly fields: JobsLogFields | undefined;
}

function createLogger(): JobsLogger & { lines: LoggedLine[]; runLines: () => LoggedLine[] } {
  const lines: LoggedLine[] = [];
  const write = (level: string) => (message: string, fields?: JobsLogFields) => lines.push({ level, message, fields });
  const runLines = () => lines.filter((line) => line.message.startsWith("job run "));
  return { lines, runLines, info: write("info"), warn: write("warn"), error: write("error") };
}

const payload = z.strictObject({ messageId: z.string() });

describe("the line at the end of a run", () => {
  let test: TestJobs | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  async function setup(options: Partial<JobsOptionsInput> = {}): Promise<TestJobs> {
    test = await createTestJobs(options);
    return test;
  }

  function run(jobs: TestJobs, handlers: JobHandlers, logger: JobsLogger) {
    return runDueJobs(jobs.ctx, { handlers, logger, random: () => 0 });
  }

  it("logs a success with its origin, duration and the summary's code and item counts", async () => {
    const jobs = await setup();
    const logger = createLogger();
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: () => {
          jobs.clock.advance(1500);
          return Promise.resolve(ok({ summary: { code: "sync.imported", items: { new: 3, skipped: 1 }, steps: { fetch: "done" as const } } }));
        },
      }),
    };
    const { id } = await enqueueJob(jobs.ctx, { queue: "ai.reply", payload: { messageId: "m-1" }, origin: "manual" });

    expect(await run(jobs, handlers, logger)).toMatchObject({ succeeded: 1 });
    expect(logger.lines).toEqual([
      {
        level: "info",
        message: "job run succeeded",
        fields: { queue: "ai.reply", jobId: id, attempt: 1, origin: "manual", durationMs: 1500, code: "sync.imported", items: { new: 3, skipped: 1 } },
      },
    ]);
  });

  it("logs a success without a summary with no code or items", async () => {
    const jobs = await setup();
    const logger = createLogger();
    const { id } = await enqueueJob(jobs.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });

    await run(jobs, { "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(ok()) }) }, logger);
    expect(logger.runLines()).toEqual([
      { level: "info", message: "job run succeeded", fields: { queue: "ai.reply", jobId: id, attempt: 1, origin: "app", durationMs: 0 } },
    ]);
  });

  it("logs a returned error as retried with its code and next run, then as failed once the attempts are used up", async () => {
    const jobs = await setup();
    const logger = createLogger();
    const handlers = { "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(err("app.provider_down")) }) };
    const { id } = await enqueueJob(jobs.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });

    await run(jobs, handlers, logger);
    jobs.clock.advance(10 * SECOND_MS);
    await run(jobs, handlers, logger);
    jobs.clock.advance(20 * SECOND_MS);
    await run(jobs, handlers, logger);

    const fields = { queue: "ai.reply", jobId: id, code: "app.provider_down" };
    expect(logger.lines).toEqual([
      { level: "warn", message: "job run failed; retrying", fields: { ...fields, attempt: 1, runAt: new Date(NOW.getTime() + 10 * SECOND_MS).toISOString() } },
      { level: "warn", message: "job run failed; retrying", fields: { ...fields, attempt: 2, runAt: new Date(NOW.getTime() + 30 * SECOND_MS).toISOString() } },
      { level: "error", message: "job run failed", fields: { ...fields, attempt: 3 } },
    ]);
  });

  it("logs failJob as failed at once, without the payload", async () => {
    const jobs = await setup();
    const logger = createLogger();
    const handlers = { "ai.reply": defineJobHandler({ payload, run: () => Promise.resolve(failJob("app.message_gone")) }) };
    const { id } = await enqueueJob(jobs.ctx, { queue: "ai.reply", payload: { messageId: "secret-id" } });

    await run(jobs, handlers, logger);
    expect(logger.lines).toEqual([{ level: "error", message: "job run failed", fields: { queue: "ai.reply", jobId: id, attempt: 1, code: "app.message_gone" } }]);
    expect(JSON.stringify(logger.lines)).not.toContain("secret-id");
  });

  it("logs nothing for an attempt whose write is refused because another worker took the job over", async () => {
    const jobs = await setup();
    const logger = createLogger();
    const handlers = {
      "ai.reply": defineJobHandler({
        payload,
        run: async () => {
          jobs.clock.advance(60 * SECOND_MS);
          await claimJobs(jobs.ctx, { queue: "ai.reply", limit: 1, workerId: "worker-b" });
          return ok();
        },
      }),
    };
    await enqueueJob(jobs.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });

    expect(await run(jobs, handlers, logger)).toMatchObject({ succeeded: 0, stale: 1 });
    expect(logger.runLines()).toEqual([]);
  });

  it("logs a job failed by an expired lease with no attempts left", async () => {
    const jobs = await setup();
    const logger = createLogger();
    const { id } = await enqueueJob(jobs.ctx, { queue: "mail.send", payload: {} });
    await claimJobs(jobs.ctx, { queue: "mail.send", limit: 1, workerId: "worker-a", logger });
    jobs.clock.advance(300 * SECOND_MS);
    await claimJobs(jobs.ctx, { queue: "mail.send", limit: 1, workerId: "worker-b", logger });

    expect(logger.lines).toEqual([{ level: "error", message: "job run failed", fields: { queue: "mail.send", jobId: id, attempt: 1, code: "jobs.lease_expired" } }]);
  });

  it("logs only retries and failures with logRuns failures", async () => {
    const jobs = await setup({ logRuns: "failures" });
    const logger = createLogger();
    const handlers = {
      "ai.reply": defineJobHandler({ payload, run: ({ messageId }) => Promise.resolve(messageId === "m-1" ? ok() : err("app.provider_down")) }),
    };
    await enqueueJob(jobs.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });
    await enqueueJob(jobs.ctx, { queue: "ai.reply", payload: { messageId: "m-2" } });

    expect(await run(jobs, handlers, logger)).toMatchObject({ succeeded: 1, retried: 1 });
    expect(logger.runLines().map((line) => line.message)).toEqual(["job run failed; retrying"]);
  });

  it("logs no run line with logRuns none", async () => {
    const jobs = await setup({ logRuns: "none" });
    const logger = createLogger();
    const handlers = {
      "ai.reply": defineJobHandler({ payload, run: ({ messageId }) => Promise.resolve(messageId === "m-1" ? ok() : failJob("app.message_gone")) }),
    };
    await enqueueJob(jobs.ctx, { queue: "ai.reply", payload: { messageId: "m-1" } });
    await enqueueJob(jobs.ctx, { queue: "ai.reply", payload: { messageId: "m-2" } });

    expect(await run(jobs, handlers, logger)).toMatchObject({ succeeded: 1, failed: 1 });
    expect(logger.runLines()).toEqual([]);
  });

  it("refuses a logRuns value it does not know", async () => {
    // @ts-expect-error: a JavaScript config can pass anything.
    await expect(setup({ logRuns: "some" })).rejects.toThrow("logRuns");
  });
});
