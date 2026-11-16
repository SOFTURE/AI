// The Workers tick: one bounded round that enqueues due schedules, runs due jobs up to each queue's concurrency,
// reports jobs that outlive its budget, prunes once an hour across ticks and writes a heartbeat row.
import { ok, systemClock } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers } from "@softure-ai/jobs";
import { checkJobsTickHealth, enqueueJob, getJob, listJobRuns, listSyncItems, runJobsTick, type JobsLogger } from "@softure-ai/jobs/server";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestJobs, NOW, type TestJobs } from "./support.js";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function createRecordingLogger(): JobsLogger & { lines: string[] } {
  const lines: string[] = [];
  const write = (level: string) => (message: string) => lines.push(`${level}: ${message}`);
  return { lines, info: write("info"), warn: write("warn"), error: write("error") };
}

const silentLogger: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("runJobsTick", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("runs every due job, at most the queue's concurrency at once, and stops when nothing is due", async () => {
    test = await createTestJobs({ pollIntervalMs: 50 });
    let active = 0;
    let peak = 0;
    const handlers: JobHandlers = {
      "ai.reply": defineJobHandler({
        payload: z.object({}),
        run: async () => {
          active += 1;
          peak = Math.max(peak, active);
          await delay(20);
          active -= 1;
          return ok();
        },
      }),
    };
    const ids = await Promise.all([1, 2, 3, 4, 5].map(async () => (await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} })).id));

    const report = await runJobsTick({ config: test.ctx.config, db: test.ctx.db, clock: test.clock, handlers, logger: silentLogger, runId: "tick:test" });

    expect(report).toEqual({ claimed: 5, pastBudget: 0, isPruned: true, isHealthy: true });
    expect(peak).toBe(2);
    expect((await Promise.all(ids.map((id) => getJob(test.ctx, id)))).map((job) => job?.status)).toEqual(Array(5).fill("succeeded"));
  });

  it("returns at once with nothing due and still writes its heartbeat", async () => {
    test = await createTestJobs();
    const handlers: JobHandlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };

    expect(await checkJobsTickHealth(test.ctx)).toEqual({ ok: false, reason: "missing" });
    const report = await runJobsTick({ config: test.ctx.config, db: test.ctx.db, clock: test.clock, handlers, logger: silentLogger });

    expect(report).toEqual({ claimed: 0, pastBudget: 0, isPruned: true, isHealthy: true });
    expect(await checkJobsTickHealth(test.ctx)).toEqual({ ok: true, ageMs: 0 });
    test.clock.advance(3 * MINUTE_MS + 1);
    expect(await checkJobsTickHealth(test.ctx)).toEqual({ ok: false, reason: "stale", ageMs: 3 * MINUTE_MS + 1 });
    expect(await checkJobsTickHealth(test.ctx, { maxAgeMs: 10 * MINUTE_MS })).toEqual({ ok: true, ageMs: 3 * MINUTE_MS + 1 });
    expect(await checkJobsTickHealth(test.ctx, { workerName: "other" })).toEqual({ ok: false, reason: "missing" });
  });

  it("enqueues a schedule's period once when two ticks overlap, and runs it once", async () => {
    test = await createTestJobs({ schedules: { "app.prune": { every: "1h" } } });
    const runs: unknown[] = [];
    const handlers: JobHandlers = {
      "app.prune": defineJobHandler({
        payload: z.record(z.string(), z.unknown()),
        run: async (payload) => {
          runs.push(payload);
          await delay(20);
          return ok();
        },
      }),
    };
    const tick = (runId: string) => runJobsTick({ config: test.ctx.config, db: test.ctx.db, clock: test.clock, handlers, logger: silentLogger, runId });

    const reports = await Promise.all([tick("tick:a"), tick("tick:b")]);

    expect(runs).toHaveLength(1);
    expect(reports.map((report) => report.claimed).sort()).toEqual([0, 1]);
    expect(reports.map((report) => report.isPruned).sort()).toEqual([false, true]);
  });

  it("stops claiming at its budget, reports each job still running and records it when it ends", async () => {
    test = await createTestJobs({ pollIntervalMs: 50 });
    const logger = createRecordingLogger();
    let release: () => void = () => undefined;
    const handlers: JobHandlers = {
      "ai.reply": defineJobHandler({
        payload: z.object({}),
        run: async () => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return ok();
        },
      }),
    };
    const first = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const tick = runJobsTick({ config: test.ctx.config, db: test.ctx.db, clock: systemClock, handlers, logger, budgetMs: 100, runId: "tick:test" });
    await delay(300);
    // Enqueued after the budget: this tick does not claim it.
    const second = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    release();

    const report = await tick;

    expect(report).toEqual({ claimed: 1, pastBudget: 1, isPruned: true, isHealthy: true });
    expect(logger.lines).toContain("warn: job runs past the tick's budget; it keeps its lease until it ends or the platform stops the tick");
    expect((await getJob(test.ctx, first.id))?.status).toBe("succeeded");
    expect((await getJob(test.ctx, second.id))?.status).toBe("pending");
    expect((await listJobRuns(test.ctx, { queue: "ai.reply" })).map((run) => run.outcome)).toEqual(["succeeded"]);
  });

  it("prunes on its first tick and then once an hour", async () => {
    test = await createTestJobs();
    const longAgo = new Date(NOW.getTime() - 100 * 24 * HOUR_MS);
    const insertOld = (itemId: string) =>
      test.database.client.query(
        `INSERT INTO jobs.sync_items (source, item_id, status, attempts, first_seen_at, last_seen_at, updated_at, finished_at)
         VALUES ('gmail.inbox', $2, 'done', 1, $1, $1, $1, $1)`,
        [longAgo, itemId],
      );
    const handlers: JobHandlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
    const tick = () => runJobsTick({ config: test.ctx.config, db: test.ctx.db, clock: test.clock, handlers, logger: silentLogger });

    await insertOld("first");
    expect((await tick()).isPruned).toBe(true);
    expect(await listSyncItems(test.ctx)).toEqual([]);

    await insertOld("second");
    test.clock.advance(59 * MINUTE_MS);
    expect((await tick()).isPruned).toBe(false);
    expect(await listSyncItems(test.ctx)).toHaveLength(1);

    test.clock.advance(MINUTE_MS);
    expect((await tick()).isPruned).toBe(true);
    expect(await listSyncItems(test.ctx)).toEqual([]);
  });

  it("logs a failed claim as an error, ends the tick and leaves the heartbeat unwritten", async () => {
    test = await createTestJobs();
    const logger = createRecordingLogger();
    const handlers: JobHandlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
    await test.database.client.query("ALTER TABLE jobs.jobs RENAME TO jobs_moved");

    const report = await runJobsTick({ config: test.ctx.config, db: test.ctx.db, clock: test.clock, handlers, logger });

    expect(report.isHealthy).toBe(false);
    expect(report.claimed).toBe(0);
    expect(logger.lines).toContain("error: could not claim jobs; the next tick tries again");
    expect(await checkJobsTickHealth(test.ctx)).toEqual({ ok: false, reason: "missing" });
  });

  it("refuses a handler set with no configured queue before touching the database", async () => {
    test = await createTestJobs();
    await expect(runJobsTick({ config: test.ctx.config, db: test.ctx.db, handlers: {}, logger: silentLogger })).rejects.toThrow(
      "@softure-ai/jobs: the tick has no queue to run; pass a handler for at least one configured queue",
    );
  });
});
