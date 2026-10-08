// What `/api/health` answers, tested the way an app tests it: a plain call with a config, no Next,
// no request scope, no registry and no mock of `next/server`.
import { closeHealthDatabases, createHealthResponse } from "@softure-ai/ops/server";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, failingCheck, passingCheck } from "./support.js";

describe("createHealthResponse", () => {
  let errors: unknown[][];
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });

  beforeEach(() => {
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await closeHealthDatabases();
  });

  it("answers 200, only the status and no-store when the database and every check pass", async () => {
    const response = await createHealthResponse(
      createConfig({ modules: [passingCheck], ops: { getDatabase: () => Promise.resolve(database.db) } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503 and reveals nothing when the app's getDatabase fails", async () => {
    const getDatabase = () => Promise.reject(new RangeError("pool closed: secret detail"));
    const response = await createHealthResponse(createConfig({ ops: { getDatabase } }));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(errors).toEqual([['health check "database" failed: could not open the database: RangeError']]);
  });

  it("lists every check with detail: checks", async () => {
    const response = await createHealthResponse(
      createConfig({
        modules: [passingCheck],
        ops: { detail: "checks", checks: { "app.queue": failingCheck }, getDatabase: () => Promise.resolve(database.db) },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unavailable",
      checks: { database: "ok", "module-1": "ok", "app.queue": "failed" },
    });
  });

  it("throws a setup error when the ops module is not enabled", async () => {
    await expect(createHealthResponse(createConfig({ ops: null }))).rejects.toThrow(
      "GET /api/health: the ops module is not enabled; add ops() to modules in softure.config.ts",
    );
  });
});
