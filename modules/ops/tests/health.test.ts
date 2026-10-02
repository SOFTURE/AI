// The check runner: which checks run, in which order, and how each outcome counts.
import { createTestClock, err, ok } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { collectHealthChecks, createDatabaseCheck, runHealthChecks } from "@softure-ai/ops/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createConfig, failingCheck, hangingCheck, passingCheck, throwingCheck } from "./support.js";

const clock = createTestClock(new Date("2026-09-15T12:00:00Z"));

function namesOf(checks: readonly { name: string }[]): string[] {
  return checks.map((check) => check.name);
}

describe("collectHealthChecks", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });

  it("runs the database first, then each module with a check, then the app's checks", () => {
    const config = createConfig({ modules: [passingCheck, passingCheck], ops: { checks: { "app.queue": passingCheck } } });
    expect(namesOf(collectHealthChecks(config, database.db))).toEqual(["database", "module-1", "module-2", "app.queue"]);
  });

  it("has no database check without a database", () => {
    const config = createConfig({ databaseUrl: null, modules: [passingCheck] });
    expect(namesOf(collectHealthChecks(config, null))).toEqual(["module-1"]);
  });

  it("refuses an app check named like a module check", () => {
    const config = createConfig({ modules: [passingCheck], ops: { checks: { "module-1": passingCheck } } });
    expect(() => collectHealthChecks(config, database.db)).toThrow('the check name "module-1" is used twice');
  });

  it("refuses an app check named database", () => {
    const config = createConfig({ ops: { checks: { database: passingCheck } } });
    expect(() => collectHealthChecks(config, database.db)).toThrow('the check name "database" is used twice');
  });
});

describe("runHealthChecks", () => {
  let database: TestDatabase;
  let logged: string[];

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(() => {
    logged = [];
  });

  async function run(checks: Parameters<typeof runHealthChecks>[1]["checks"], timeoutMs = 200) {
    const config = createConfig({});
    return runHealthChecks({ db: database.db, clock, config }, { checks, timeoutMs, log: (line) => logged.push(line) });
  }

  it("is ok when every check passes, the database included", async () => {
    const report = await run([
      { name: "database", check: createDatabaseCheck(database.db) },
      { name: "module-1", check: passingCheck },
    ]);
    expect(report).toEqual({ status: "ok", checks: { database: "ok", "module-1": "ok" } });
    expect(logged).toEqual([]);
  });

  it("is unavailable when the database does not answer", async () => {
    const closed = await createTestDatabase();
    await closed.close();
    const report = await run([{ name: "database", check: createDatabaseCheck(closed.db) }]);
    expect(report).toEqual({ status: "unavailable", checks: { database: "failed" } });
    expect(logged).toEqual([expect.stringMatching(/^health check "database" failed: \w+/)]);
  });

  it("marks an Err as failed and logs its code", async () => {
    const report = await run([
      { name: "module-1", check: passingCheck },
      { name: "module-2", check: failingCheck },
    ]);
    expect(report).toEqual({ status: "unavailable", checks: { "module-1": "ok", "module-2": "failed" } });
    expect(logged).toEqual(['health check "module-2" failed: core.unexpected']);
  });

  it("marks a throw as failed and logs the error kind, never its text", async () => {
    const report = await run([{ name: "module-1", check: throwingCheck }]);
    expect(report.checks).toEqual({ "module-1": "failed" });
    expect(logged).toEqual(['health check "module-1" failed: TypeError']);
  });

  it("marks a synchronous throw as failed", async () => {
    const report = await run([
      {
        name: "module-1",
        check: () => {
          throw new RangeError("sync");
        },
      },
    ]);
    expect(report.checks).toEqual({ "module-1": "failed" });
  });

  it("marks a check past its time limit as timed out without waiting for it", async () => {
    const started = Date.now();
    const report = await run([
      { name: "module-1", check: hangingCheck },
      { name: "module-2", check: passingCheck },
    ], 150);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(report).toEqual({ status: "unavailable", checks: { "module-1": "timed_out", "module-2": "ok" } });
    expect(logged).toEqual(['health check "module-1" timed out after 150 ms']);
  });

  it("passes the module context to every check", async () => {
    const seen: unknown[] = [];
    await run([{ name: "module-1", check: (context) => (seen.push(context.db, context.clock), Promise.resolve(ok())) }]);
    expect(seen).toEqual([database.db, clock]);
  });

  it("is ok with no checks at all", async () => {
    expect(await run([])).toEqual({ status: "ok", checks: {} });
  });

  it("reports every failing check, not only the first", async () => {
    const report = await run([
      { name: "a", check: failingCheck },
      { name: "b", check: () => Promise.resolve(err("core.database_failed")) },
    ]);
    expect(report.checks).toEqual({ a: "failed", b: "failed" });
    expect(logged).toHaveLength(2);
  });
});
