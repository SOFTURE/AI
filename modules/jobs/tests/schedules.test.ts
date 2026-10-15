// Recurring schedules: one run per period however many runners race for it, missed periods collapse into one run, a
// run still live absorbs the next period, a success is recorded, and a schedule that stops running reads as late.
import { err, ok, systemClock } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobsOptionsInput } from "@softure-ai/jobs";
import {
  claimJobs,
  enqueueDueSchedules,
  enqueueJob,
  getQueueStats,
  getScheduleSlot,
  SCHEDULE_DEDUP_KEY,
  type JobsLogger,
} from "@softure-ai/jobs/server";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { runJobWorker } from "@softure-ai/jobs/worker";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestJobs, NOW, type TestJobs } from "./support.js";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const SCHEDULES = {
  "app.prune": { every: "1h" },
  "app.report": { every: "1d", payload: { scope: "all" } },
} satisfies JobsOptionsInput["schedules"];

const silentLogger: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function countingHandler(): { runs: unknown[]; handler: JobHandlers[string] } {
  const runs: unknown[] = [];
  const handler = defineJobHandler({
    payload: z.record(z.string(), z.unknown()),
    run: (payload) => {
      runs.push(payload);
      return Promise.resolve(ok());
    },
  });
  return { runs, handler };
}

describe("getScheduleSlot", () => {
  it("starts periods on whole multiples of the period since the epoch, in UTC", () => {
    expect(getScheduleSlot({ every: "1h", payload: {} }, new Date("2026-09-15T12:34:56Z"))).toEqual(new Date("2026-09-15T12:00:00Z"));
    expect(getScheduleSlot({ every: "15m", payload: {} }, new Date("2026-09-15T12:44:59.999Z"))).toEqual(new Date("2026-09-15T12:30:00Z"));
    expect(getScheduleSlot({ every: "1d", payload: {} }, new Date("2026-09-15T23:59:59Z"))).toEqual(new Date("2026-09-15T00:00:00Z"));
    expect(getScheduleSlot({ every: "1h", payload: {} }, new Date("2026-09-15T13:00:00Z"))).toEqual(new Date("2026-09-15T13:00:00Z"));
  });
});

describe("enqueueDueSchedules", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("enqueues one run per schedule and period, with the schedule's payload, however often it is called", async () => {
    test = await createTestJobs({ schedules: SCHEDULES });

    expect(await enqueueDueSchedules(test.ctx)).toEqual(["app.prune", "app.report"]);
    expect(await enqueueDueSchedules(test.ctx)).toEqual([]);
    test.clock.advance(30 * MINUTE_MS);
    expect(await enqueueDueSchedules(test.ctx)).toEqual([]);

    const jobs = await listJobs(test.database.db);
    expect(jobs.map((job) => [job.queue, job.payload, job.dedupKey, job.runAt])).toEqual([
      ["app.prune", {}, SCHEDULE_DEDUP_KEY, NOW],
      ["app.report", { scope: "all" }, SCHEDULE_DEDUP_KEY, NOW],
    ]);
  });

  it("enqueues the next period once the previous run finished", async () => {
    test = await createTestJobs({ schedules: SCHEDULES });
    const { runs, handler } = countingHandler();
    const handlers = { "app.prune": handler };

    await runDueJobs(test.ctx, { handlers });
    test.clock.advance(HOUR_MS);
    await runDueJobs(test.ctx, { handlers });
    test.clock.advance(HOUR_MS - 1);
    await runDueJobs(test.ctx, { handlers });

    expect(runs).toHaveLength(2);
  });

  it("does not enqueue a period again after its run finished and the dedup key is free", async () => {
    test = await createTestJobs({ schedules: SCHEDULES });
    const { runs, handler } = countingHandler();

    await runDueJobs(test.ctx, { handlers: { "app.prune": handler } });
    // A second runner (another worker, a cron) arriving later in the same period.
    await runDueJobs({ ...test.ctx }, { handlers: { "app.prune": handler } });

    expect(runs).toHaveLength(1);
    expect((await listJobs(test.database.db)).filter((job) => job.queue === "app.prune")).toHaveLength(1);
  });

  it("collapses missed periods into one run for the current period", async () => {
    test = await createTestJobs({ schedules: SCHEDULES });
    await enqueueDueSchedules(test.ctx, { queues: ["app.prune"] });
    await runDueJobs(test.ctx, { handlers: { "app.prune": countingHandler().handler } });

    test.clock.advance(5 * HOUR_MS + 10 * MINUTE_MS);
    expect(await enqueueDueSchedules(test.ctx, { queues: ["app.prune"] })).toEqual(["app.prune"]);

    const pending = (await listJobs(test.database.db)).filter((job) => job.status === "pending");
    expect(pending).toHaveLength(1);
  });

  it("joins a period to a run that is still live instead of piling up a second one", async () => {
    test = await createTestJobs({ schedules: SCHEDULES });
    const failing = defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(err("app.down")) });
    await runDueJobs(test.ctx, { handlers: { "app.prune": failing }, random: () => 0 });

    test.clock.advance(HOUR_MS);
    expect(await enqueueDueSchedules(test.ctx, { queues: ["app.prune"] })).toEqual(["app.prune"]);

    const jobs = await listJobs(test.database.db);
    expect(jobs.map((job) => [job.status, job.attempts])).toEqual([["pending", 1]]);
  });

  it("skips a period an earlier or concurrent runner already took, and never goes back to an older one", async () => {
    test = await createTestJobs({ schedules: SCHEDULES });
    test.clock.advance(2 * HOUR_MS);
    await enqueueDueSchedules(test.ctx, { queues: ["app.prune"] });

    // A runner whose clock lags behind by an hour.
    const lagging = { ...test.ctx, clock: { now: () => new Date(test.clock.now().getTime() - HOUR_MS) } };
    expect(await enqueueDueSchedules(lagging, { queues: ["app.prune"] })).toEqual([]);

    const [first, second] = await Promise.all([
      enqueueDueSchedules(test.ctx, { queues: ["app.prune"] }),
      enqueueDueSchedules(test.ctx, { queues: ["app.prune"] }),
    ]);
    expect([...(first ?? []), ...(second ?? [])]).toEqual([]);
    expect(await listJobs(test.database.db)).toHaveLength(1);
  });

  it("enqueues nothing without schedules", async () => {
    test = await createTestJobs();
    expect(await enqueueDueSchedules(test.ctx)).toEqual([]);
  });
});

describe("schedule state in getQueueStats", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  async function getSchedule(queue: string) {
    return (await getQueueStats(test.ctx)).find((stats) => stats.queue === queue)?.schedule;
  }

  it("reports a schedule no worker has seen as late, and a queue without a schedule as null", async () => {
    test = await createTestJobs({ schedules: SCHEDULES });
    expect(await getSchedule("app.prune")).toEqual({ everySeconds: 3600, lastEnqueuedAt: null, lastSucceededAt: null, isLate: true });
    expect(await getSchedule("ai.reply")).toBeNull();
  });

  it("records the last success and turns late two periods after it", async () => {
    test = await createTestJobs({ schedules: SCHEDULES });
    test.clock.advance(5 * MINUTE_MS);
    await runDueJobs(test.ctx, { handlers: { "app.prune": countingHandler().handler } });
    const succeededAt = test.clock.now();

    expect(await getSchedule("app.prune")).toEqual({ everySeconds: 3600, lastEnqueuedAt: NOW, lastSucceededAt: succeededAt, isLate: false });
    test.clock.advance(2 * HOUR_MS);
    expect((await getSchedule("app.prune"))?.isLate).toBe(false);
    test.clock.advance(1);
    expect((await getSchedule("app.prune"))?.isLate).toBe(true);
  });

  it("counts a run enqueued by hand as a success of the schedule", async () => {
    test = await createTestJobs({ schedules: SCHEDULES });
    await enqueueDueSchedules(test.ctx, { queues: ["app.report"] });
    await claimJobs(test.ctx, { queue: "app.report", limit: 1, workerId: "elsewhere" });
    await enqueueJob(test.ctx, { queue: "app.report", payload: {} });
    test.clock.advance(MINUTE_MS);

    await runDueJobs(test.ctx, { handlers: { "app.report": countingHandler().handler } });

    expect((await getSchedule("app.report"))?.lastSucceededAt).toEqual(test.clock.now());
  });

  it("stays late while every run fails, counting from when a worker first saw the schedule", async () => {
    test = await createTestJobs({ schedules: SCHEDULES, queues: { "app.prune": { maxAttempts: 1 } } });
    const failing = defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(err("app.down")) });
    await runDueJobs(test.ctx, { handlers: { "app.prune": failing } });
    expect((await getSchedule("app.prune"))?.isLate).toBe(false);

    for (let hour = 0; hour < 2; hour += 1) {
      test.clock.advance(HOUR_MS);
      await runDueJobs(test.ctx, { handlers: { "app.prune": failing } });
    }
    test.clock.advance(1);
    expect(await getSchedule("app.prune")).toMatchObject({ lastSucceededAt: null, isLate: true });
  });
});

describe("runJobWorker with schedules", () => {
  let test: TestJobs;

  afterEach(async () => {
    await test.database.close();
  });

  it("enqueues and runs the due runs of its own queues only", async () => {
    test = await createTestJobs({ schedules: SCHEDULES, pollIntervalMs: 50 });
    const { runs, handler } = countingHandler();
    const controller = new AbortController();
    const worker = runJobWorker({
      db: test.database.db,
      config: test.ctx.config,
      handlers: { "app.prune": handler },
      signal: controller.signal,
      logger: silentLogger,
      clock: systemClock,
    });

    const deadline = Date.now() + 5000;
    while (runs.length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    await new Promise((resolve) => setTimeout(resolve, 200));
    controller.abort();
    await worker;

    expect(runs).toEqual([{}]);
    expect((await listJobs(test.database.db)).map((job) => job.queue)).toEqual(["app.prune"]);
  });
});
