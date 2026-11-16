// The Cron Trigger handler of `@softure-ai/jobs/workers`: one tick per firing, run inside the request database scope
// opened on the URL from the Worker's env, kept alive with `waitUntil` and named after the firing's time.
import { ok } from "@softure-ai/core";
import type { Queryable, RequestDatabaseOptions } from "@softure-ai/db/request";
import { defineJobHandler, type JobHandlers } from "@softure-ai/jobs";
import { enqueueJob, getJob, type JobsLogger } from "@softure-ai/jobs/server";
import { createScheduledHandler } from "@softure-ai/jobs/workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTestJobs, type TestJobs } from "./support.js";

const scope = vi.hoisted(() => ({
  db: undefined as Queryable | undefined,
  opened: [] as RequestDatabaseOptions[],
}));

vi.mock("@softure-ai/db/request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@softure-ai/db/request")>();
  return {
    ...actual,
    withRequestDatabase: <T>(options: RequestDatabaseOptions, run: () => Promise<T>): Promise<T> => {
      scope.opened.push(options);
      if (options.url.startsWith("pglite://")) return actual.withRequestDatabase(options, run);
      return run();
    },
    getConfiguredDatabase: (...args: Parameters<typeof actual.getConfiguredDatabase>) =>
      scope.db === undefined ? actual.getConfiguredDatabase(...args) : Promise.resolve({ db: scope.db }),
  };
});

interface Env {
  readonly HYPERDRIVE: { readonly connectionString: string };
}

const FIRED_AT = Date.parse("2026-11-16T10:00:00Z");

function createRecordingLogger(): JobsLogger & { lines: string[] } {
  const lines: string[] = [];
  const write = (level: string) => (message: string) => lines.push(`${level}: ${message}`);
  return { lines, info: write("info"), warn: write("warn"), error: write("error") };
}

describe("createScheduledHandler", () => {
  let test: TestJobs;

  beforeEach(async () => {
    test = await createTestJobs();
    scope.db = test.ctx.db;
    scope.opened = [];
  });

  afterEach(async () => {
    scope.db = undefined;
    await test.database.close();
  });

  it("runs one tick on the env's database, hands it to waitUntil and names the claim after the firing", async () => {
    const handlers: JobHandlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
    const job = await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const waited: Promise<unknown>[] = [];
    const scheduled = createScheduledHandler<Env>({
      config: test.ctx.config,
      handlers,
      databaseUrl: (env) => env.HYPERDRIVE.connectionString,
      logger: createRecordingLogger(),
    });

    const report = await scheduled(
      { scheduledTime: FIRED_AT, cron: "* * * * *" },
      { HYPERDRIVE: { connectionString: "postgres://hyperdrive.local/app" } },
      { waitUntil: (promise) => waited.push(promise) },
    );

    expect(report).toMatchObject({ claimed: 1, pastBudget: 0, isHealthy: true });
    expect(scope.opened.map((options) => options.url)).toEqual(["postgres://hyperdrive.local/app"]);
    expect(waited.length).toBeGreaterThanOrEqual(1);
    expect((await getJob(test.ctx, job.id))?.status).toBe("succeeded");
    const rows = await test.database.client.query<{ locked_by: string | null }>("SELECT locked_by FROM jobs.jobs");
    expect(rows.rows).toEqual([{ locked_by: null }]);
  });

  it("claims under the tick's name and firing time", async () => {
    let lockedBy: string | null = null;
    const handlers: JobHandlers = {
      "ai.reply": defineJobHandler({
        payload: z.object({}),
        run: async () => {
          const rows = await test.database.client.query<{ locked_by: string }>("SELECT locked_by FROM jobs.jobs WHERE status = 'running'");
          lockedBy = rows.rows[0]?.locked_by ?? null;
          return ok();
        },
      }),
    };
    await enqueueJob(test.ctx, { queue: "ai.reply", payload: {} });
    const scheduled = createScheduledHandler<Env>({
      config: test.ctx.config,
      handlers,
      databaseUrl: (env) => env.HYPERDRIVE.connectionString,
      workerName: "cron",
      logger: createRecordingLogger(),
    });

    await scheduled({ scheduledTime: FIRED_AT, cron: "* * * * *" }, { HYPERDRIVE: { connectionString: "postgres://h/app" } }, { waitUntil: () => undefined });

    expect(lockedBy).toBe("cron:2026-11-16T10:00:00.000Z");
  });

  it("logs and rejects a tick that cannot open its database, so the firing shows as failed", async () => {
    scope.db = undefined;
    const logger = createRecordingLogger();
    const handlers: JobHandlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
    const waited: Promise<unknown>[] = [];
    const scheduled = createScheduledHandler<Env>({ config: test.ctx.config, handlers, databaseUrl: (env) => env.HYPERDRIVE.connectionString, logger });

    await expect(
      scheduled({ scheduledTime: FIRED_AT, cron: "* * * * *" }, { HYPERDRIVE: { connectionString: "pglite://" } }, { waitUntil: (promise) => waited.push(promise) }),
    ).rejects.toThrow("withRequestDatabase: PGlite is Node-only");
    expect(logger.lines).toEqual(["error: the jobs tick failed: withRequestDatabase: PGlite is Node-only; use a postgres:// URL (on Workers, a Hyperdrive binding)"]);
    // The promise handed to waitUntil never rejects, so the runtime reports the failure once, through the handler.
    await expect(Promise.all(waited)).resolves.toBeDefined();
  });
});
