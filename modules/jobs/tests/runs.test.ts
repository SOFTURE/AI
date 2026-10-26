// The run history (#803): what started a job (`origin`), one row per recorded attempt with the handler's code-only
// summary, its own retention, and the read for an operator's runs page.
import { err, ok } from "@softure-ai/core";
import { defineJobHandler, failJob, type JobHandlers, type JobsOptionsInput } from "@softure-ai/jobs";
import { claimJobs, completeJob, enqueueJob, getJob, retryJob, runScheduleNow, type JobsLogger, type JobsLogFields } from "@softure-ai/jobs/server";
import { listJobs, listRunHistory, runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestJobs, NOW, SECOND_MS, type TestJobs } from "./support.js";

const SCHEDULES = { "app.sync": { every: "1h", payload: { full: false } } } satisfies JobsOptionsInput["schedules"];

function createLogger(): JobsLogger & { lines: string[]; fields: JobsLogFields[] } {
  const lines: string[] = [];
  const fields: JobsLogFields[] = [];
  const write = (level: string) => (message: string, logged: JobsLogFields = {}) => {
    lines.push(`${level}: ${message}`);
    fields.push(logged);
  };
  return { lines, fields, info: write("info"), warn: write("warn"), error: write("error") };
}

describe("the run history", () => {
  let test: TestJobs;
  const logger = createLogger();

  afterEach(async () => {
    await test.database.close();
  });

  function run(handlers: JobHandlers) {
    return runDueJobs(test.ctx, { handlers, logger, random: () => 0 });
  }

  describe("origin", () => {
    it("is app for enqueueJob unless the caller names one", async () => {
      test = await createTestJobs();
      const plain = await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });
      const named = await enqueueJob(test.ctx, { queue: "mail.send", payload: {}, origin: "webhook.stripe" });

      expect(await getJob(test.ctx, plain.id)).toMatchObject({ origin: "app" });
      expect(await getJob(test.ctx, named.id)).toMatchObject({ origin: "webhook.stripe" });
    });

    it("refuses an origin that is not a lowercase code", async () => {
      test = await createTestJobs();
      for (const origin of ["", "Manual", "a b", "x".repeat(64)]) {
        await expect(enqueueJob(test.ctx, { queue: "mail.send", payload: {}, origin })).rejects.toThrow(RangeError);
      }
    });

    it("is schedule for a run the schedule enqueued and manual for runScheduleNow unless named", async () => {
      test = await createTestJobs({ schedules: SCHEDULES });
      await run({ "app.sync": defineJobHandler({ payload: z.unknown(), run: () => Promise.resolve(ok()) }) });
      const manual = await runScheduleNow(test.ctx, "app.sync");
      if (!manual.ok) throw new Error("expected a run");
      await run({ "app.sync": defineJobHandler({ payload: z.unknown(), run: () => Promise.resolve(ok()) }) });
      const named = await runScheduleNow(test.ctx, "app.sync", { origin: "cli" });
      if (!named.ok) throw new Error("expected a run");

      expect((await listJobs(test.database.db)).map((job) => job.origin)).toEqual(["schedule", "manual", "cli"]);
    });

    it("stays the same when a failed job is run again", async () => {
      test = await createTestJobs();
      const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {}, origin: "manual" });
      await run({ "mail.send": defineJobHandler({ payload: z.unknown(), run: () => Promise.resolve(failJob("app.bounced")) }) });
      expect(await retryJob(test.ctx, id)).toMatchObject({ ok: true, value: { origin: "manual" } });
    });
  });

  describe("one run per recorded attempt", () => {
    it("records a retried and then a succeeded attempt with origin, attempt, times and the summary", async () => {
      test = await createTestJobs();
      let calls = 0;
      const handlers = {
        "ai.reply": defineJobHandler({
          payload: z.unknown(),
          run: () => {
            calls += 1;
            if (calls === 1) return Promise.resolve(err("app.provider_down"));
            return Promise.resolve(ok({ summary: { code: "sync.imported", items: { new: 3, skipped: 1, failed: 0 }, steps: { fetch: "done", notify: "skipped" } } }));
          },
        }),
      };
      const { id } = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {}, origin: "manual" });
      await run(handlers);
      test.clock.advance(10 * SECOND_MS);
      await run(handlers);

      const later = new Date(NOW.getTime() + 10 * SECOND_MS);
      expect(await listRunHistory(test.database.db)).toEqual([
        { id: expect.any(String) as string, jobId: id, queue: "ai.reply", origin: "manual", attempt: 1, outcome: "retried", errorCode: "app.provider_down", summary: null, startedAt: NOW, finishedAt: NOW },
        {
          id: expect.any(String) as string,
          jobId: id,
          queue: "ai.reply",
          origin: "manual",
          attempt: 2,
          outcome: "succeeded",
          errorCode: null,
          summary: { code: "sync.imported", items: { new: 3, skipped: 1, failed: 0 }, steps: { fetch: "done", notify: "skipped" } },
          startedAt: later,
          finishedAt: later,
        },
      ]);
    });

    it("records a succeeded attempt without a summary when ok() carries none, or a value of its own", async () => {
      test = await createTestJobs();
      await enqueueJob(test.ctx, { queue: "mail.send", payload: { n: 1 } });
      await enqueueJob(test.ctx, { queue: "mail.send", payload: { n: 2 } });
      const values = [undefined, { sentTo: 4 }];
      await run({ "mail.send": defineJobHandler({ payload: z.object({ n: z.number() }), run: ({ n }) => Promise.resolve(ok(values[n - 1])) }) });

      expect((await listRunHistory(test.database.db)).map((row) => [row.outcome, row.summary])).toEqual([
        ["succeeded", null],
        ["succeeded", null],
      ]);
    });

    it("keeps the success of a handler whose summary is invalid, drops the summary and warns with paths only", async () => {
      test = await createTestJobs();
      const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {} });
      const summary = { items: { new: -1 }, note: "the customer's e-mail" };
      await run({ "mail.send": defineJobHandler({ payload: z.unknown(), run: () => Promise.resolve(ok({ summary })) }) });

      expect(await getJob(test.ctx, id)).toMatchObject({ status: "succeeded" });
      expect(await listRunHistory(test.database.db)).toMatchObject([{ outcome: "succeeded", summary: null }]);
      const index = logger.lines.indexOf("warn: job summary does not match the summary schema; recorded without it");
      expect(index).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(logger.fields[index])).not.toContain("e-mail");
      expect(logger.fields[index]).toMatchObject({ queue: "mail.send", jobId: id, paths: expect.stringContaining("items.new") as string });
    });

    it("records a terminal failure with its code, an invalid payload included", async () => {
      test = await createTestJobs();
      const failed = await enqueueJob(test.ctx, { queue: "mail.send", payload: { to: "x" } });
      const invalid = await enqueueJob(test.ctx, { queue: "mail.send", payload: { other: 1 } });
      await run({ "mail.send": defineJobHandler({ payload: z.strictObject({ to: z.string() }), run: () => Promise.resolve(failJob("app.bounced")) }) });

      expect((await listRunHistory(test.database.db)).map((row) => [row.jobId, row.outcome, row.errorCode])).toEqual([
        [failed.id, "failed", "app.bounced"],
        [invalid.id, "failed", "jobs.invalid_payload"],
      ]);
    });

    it("records a failed run without a start when a lease ends with no attempts left", async () => {
      test = await createTestJobs();
      const { id } = await enqueueJob(test.ctx, { queue: "mail.send", payload: {}, origin: "manual" });
      await claimJobs(test.ctx, { queue: "mail.send", limit: 1, workerId: "worker-a" });
      test.clock.advance(300 * SECOND_MS);
      await claimJobs(test.ctx, { queue: "mail.send", limit: 1, workerId: "worker-b" });

      expect(await listRunHistory(test.database.db)).toMatchObject([
        { jobId: id, origin: "manual", attempt: 1, outcome: "failed", errorCode: "jobs.lease_expired", startedAt: null, finishedAt: new Date(NOW.getTime() + 300 * SECOND_MS) },
      ]);
    });

    it("records nothing for an attempt another claim replaced", async () => {
      test = await createTestJobs();
      await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
      const [stale] = await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "worker-a" });
      if (stale === undefined) throw new Error("expected a claim");
      test.clock.advance(60 * SECOND_MS);
      await claimJobs(test.ctx, { queue: "ai.reply", limit: 1, workerId: "worker-b" });

      expect(await completeJob(test.ctx, stale, { kind: "succeeded", summary: { code: "app.done" } })).toBe(false);
      expect(await listRunHistory(test.database.db)).toEqual([]);
    });
  });
});
