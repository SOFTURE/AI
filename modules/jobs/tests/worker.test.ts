// The worker loop on a real clock with short intervals: it runs due jobs up to each queue's concurrency, keeps
// leases alive, stops claiming on abort and releases what the grace period did not let finish.
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { err, ok, systemClock, type SoftureConfig } from "@softure-ai/core";
import { defineJobHandler, type JobsOptionsInput } from "@softure-ai/jobs";
import { enqueueJob, getJob, listSyncItems, type JobsContext, type JobsLogger } from "@softure-ai/jobs/server";
import { runJobWorker, runJobWorkerProcess } from "@softure-ai/jobs/worker";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig } from "./support.js";

const FAST = { pollIntervalMs: 50 } satisfies Partial<JobsOptionsInput>;

const silentLogger: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function createRecordingLogger(): JobsLogger & { lines: string[] } {
  const lines: string[] = [];
  const write = (level: string) => (message: string) => lines.push(`${level}: ${message}`);
  return { lines, info: write("info"), warn: write("warn"), error: write("error") };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("waitFor: timed out");
    await delay(20);
  }
}

describe("runJobWorker", () => {
  let database: TestDatabase;
  let config: SoftureConfig;
  let ctx: JobsContext;

  async function setUp(options: Partial<JobsOptionsInput> = {}): Promise<void> {
    config = createConfig({ ...FAST, ...options });
    database = await createTestDatabase(config.modules);
    ctx = { db: database.db, clock: systemClock, config };
  }

  afterEach(async () => {
    await database.close();
  });

  it("runs due jobs until aborted, with at most the queue's concurrency at once", async () => {
    await setUp();
    let active = 0;
    let peak = 0;
    const handlers = {
      "ai.reply": defineJobHandler({
        payload: z.object({}),
        run: async () => {
          active += 1;
          peak = Math.max(peak, active);
          await delay(30);
          active -= 1;
          return ok();
        },
      }),
    };
    const ids = await Promise.all([1, 2, 3, 4, 5].map(async () => (await enqueueJob(ctx, { queue: "ai.reply", payload: {} })).id));
    const controller = new AbortController();
    const worker = runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger: silentLogger, workerId: "test" });

    await waitFor(async () => (await Promise.all(ids.map((id) => getJob(ctx, id)))).every((job) => job?.status === "succeeded"));
    controller.abort();
    await worker;
    expect(peak).toBe(2);
  });

  it("prunes sync ledger items past their retention on its first round", async () => {
    await setUp();
    const longAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await database.client.query(
      `INSERT INTO jobs.sync_items (source, item_id, status, attempts, first_seen_at, last_seen_at, updated_at, finished_at)
       VALUES ('gmail.inbox', 'old', 'done', 1, $1, $1, $1, $1), ('gmail.inbox', 'recent', 'done', 1, now(), now(), now(), now())`,
      [longAgo],
    );
    const logger = createRecordingLogger();
    const controller = new AbortController();
    const handlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
    const worker = runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger, workerId: "test" });

    await waitFor(async () => (await listSyncItems(ctx)).length === 1);
    controller.abort();
    await worker;
    expect((await listSyncItems(ctx)).map((item) => item.itemId)).toEqual(["recent"]);
    expect(logger.lines).toContain("info: pruned sync ledger items");
  });

  it("picks up a job enqueued while it waits", async () => {
    await setUp();
    const controller = new AbortController();
    const handlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
    const worker = runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger: silentLogger });
    await delay(100);
    const { id } = await enqueueJob(ctx, { queue: "ai.reply", payload: {} });
    await waitFor(async () => (await getJob(ctx, id))?.status === "succeeded");
    controller.abort();
    await worker;
  });

  it("keeps a long job's lease alive", async () => {
    await setUp();
    const controller = new AbortController();
    let lockedUntil: Date | null | undefined;
    const handlers = {
      "ai.reply": defineJobHandler({
        payload: z.object({}),
        run: async (_payload, { job }) => {
          await delay(200);
          lockedUntil = (await getJob(ctx, job.id))?.lockedUntil;
          return ok();
        },
      }),
    };
    const { id } = await enqueueJob(ctx, { queue: "ai.reply", payload: {} });
    const claimedAt = Date.now();
    const worker = runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger: silentLogger, heartbeatMs: 40 });
    await waitFor(async () => (await getJob(ctx, id))?.status === "succeeded");
    controller.abort();
    await worker;
    // The claim set the lease to claim time + 60 s; a heartbeat moved it later.
    expect(lockedUntil?.getTime()).toBeGreaterThan(claimedAt + 60_000 + 100);
  });

  it("on abort waits for running jobs within the grace period", async () => {
    await setUp({ shutdownGraceMs: 1000 });
    const controller = new AbortController();
    let started = false;
    const handlers = {
      "ai.reply": defineJobHandler({
        payload: z.object({}),
        run: async () => {
          started = true;
          await delay(150);
          return ok();
        },
      }),
    };
    const { id } = await enqueueJob(ctx, { queue: "ai.reply", payload: {} });
    const worker = runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger: silentLogger });
    await waitFor(() => Promise.resolve(started));
    controller.abort();
    await worker;
    expect(await getJob(ctx, id)).toMatchObject({ status: "succeeded" });
  });

  it("after the grace period aborts the handler and releases its job with the attempt given back", async () => {
    await setUp({ shutdownGraceMs: 50 });
    const controller = new AbortController();
    let handlerSignal: AbortSignal | undefined;
    const handlers = {
      "mail.send": defineJobHandler({
        payload: z.object({}),
        run: async (_payload, { signal }) => {
          handlerSignal = signal;
          await new Promise((resolve) => signal.addEventListener("abort", resolve));
          return err("app.aborted");
        },
      }),
    };
    const logger = createRecordingLogger();
    const { id } = await enqueueJob(ctx, { queue: "mail.send", payload: {} });
    const worker = runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger });
    await waitFor(() => Promise.resolve(handlerSignal !== undefined));
    controller.abort();
    await worker;
    expect(handlerSignal?.aborted).toBe(true);
    expect(await getJob(ctx, id)).toMatchObject({ status: "pending", attempts: 0, lockedBy: null, lastError: null });
    expect(logger.lines).toContain("info: job released for another worker");
  });

  it("refuses to start without a handler for any configured queue", async () => {
    await setUp();
    await expect(runJobWorker({ db: database.db, config, handlers: {}, signal: new AbortController().signal, logger: silentLogger })).rejects.toThrow(
      "the worker has no queue to run",
    );
  });

  it("logs configured queues it has no handler for", async () => {
    await setUp();
    const logger = createRecordingLogger();
    const controller = new AbortController();
    controller.abort();
    const handlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
    await runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger });
    expect(logger.lines).toEqual(["warn: configured queues without a handler are not run by this worker", "info: worker started", "info: worker stopped"]);
  });
});

describe("runJobWorkerProcess", () => {
  it("runs the worker on the given database, stops on the signal and exits 0", async () => {
    const config = createConfig(FAST);
    const database = await createTestDatabase(config.modules);
    try {
      const ctx = { db: database.db, clock: systemClock, config };
      const { id } = await enqueueJob(ctx, { queue: "ai.reply", payload: {} });
      const controller = new AbortController();
      const handlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
      const exit = runJobWorkerProcess({ config, handlers, database: database.db, signal: controller.signal, logger: silentLogger });
      await waitFor(async () => (await getJob(ctx, id))?.status === "succeeded");
      controller.abort();
      expect(await exit).toBe(0);
      expect(process.exitCode).toBe(0);
    } finally {
      process.exitCode = undefined;
      await database.close();
    }
  });

  it("exits 1 without a database or when the worker cannot start", async () => {
    const logger = createRecordingLogger();
    const config = { ...createConfig(), database: null };
    const handlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
    try {
      expect(await runJobWorkerProcess({ config, handlers, logger })).toBe(1);
      expect(logger.lines).toEqual(["error: the config has no database; set database.url in softure.config"]);
      const withDatabase = createConfig();
      const database = await createTestDatabase(withDatabase.modules);
      try {
        expect(await runJobWorkerProcess({ config: withDatabase, handlers: {}, logger, database: database.db })).toBe(1);
      } finally {
        await database.close();
      }
    } finally {
      process.exitCode = undefined;
    }
  });
});
