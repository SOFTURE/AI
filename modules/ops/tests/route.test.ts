// `GET /api/health` as the app mounts it: config from the registry, a real (PGlite) database.
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { closeHealthDatabases, GET } from "@softure-ai/ops/next";
import { closeConfiguredDatabases, closeSharedDatabases, createPgliteHandle, getSharedDatabase } from "@softure-ai/db";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, failingCheck, passingCheck } from "./support.js";

const { connection } = vi.hoisted(() => ({ connection: vi.fn(() => Promise.resolve()) }));
vi.mock("next/server", () => ({ connection }));

describe("GET /api/health", () => {
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
    clearSoftureConfig();
    await closeHealthDatabases();
    await closeSharedDatabases();
    await closeConfiguredDatabases();
  });

  it("opts into dynamic rendering with connection() on every request, before it answers", async () => {
    connection.mockClear();
    registerSoftureConfig(createConfig({ databaseUrl: null, modules: [passingCheck] }));
    await GET();
    await GET();
    expect(connection).toHaveBeenCalledTimes(2);
  });

  it("answers 200 and only the status when the database and every check pass", async () => {
    registerSoftureConfig(createConfig({ modules: [passingCheck], ops: { getDatabase: () => Promise.resolve(database.db) } }));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503 and reveals nothing when a module check fails", async () => {
    registerSoftureConfig(createConfig({ databaseUrl: null, modules: [passingCheck, failingCheck] }));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(errors).toEqual([['health check "module-2" failed: core.unexpected']]);
  });

  it("lists every check with detail: checks", async () => {
    registerSoftureConfig(
      createConfig({
        modules: [passingCheck],
        ops: { detail: "checks", checks: { "app.queue": failingCheck }, getDatabase: () => Promise.resolve(database.db) },
      }),
    );
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unavailable",
      checks: { database: "ok", "module-1": "ok", "app.queue": "failed" },
    });
  });

  it("answers 503 when the database cannot be reached", async () => {
    // Nothing listens on port 1: the connection is refused at once.
    registerSoftureConfig(createConfig({ databaseUrl: "postgresql://nobody:secret@127.0.0.1:1/none", ops: { detail: "checks" } }));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable", checks: { database: "failed" } });
    expect(JSON.stringify(errors)).not.toContain("secret");
  });

  it("answers 503 when the database URL cannot be opened", async () => {
    registerSoftureConfig(createConfig({ databaseUrl: "mysql://somewhere/db", ops: { detail: "checks" } }));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable", checks: { database: "failed" } });
    expect(errors).toEqual([['health check "database" failed: could not open the database: Error']]);
  });

  it("answers 503 when the app's getDatabase fails", async () => {
    const getDatabase = () => Promise.reject(new RangeError("pool closed"));
    registerSoftureConfig(createConfig({ ops: { detail: "checks", getDatabase } }));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable", checks: { database: "failed" } });
    expect(errors).toEqual([['health check "database" failed: could not open the database: RangeError']]);
  });

  it("checks a pglite database through the process's shared handle, not a second instance", async () => {
    registerSoftureConfig(createConfig({ databaseUrl: "pglite://", modules: [passingCheck], ops: { detail: "checks" } }));
    const shared = await getSharedDatabase("pglite://");
    if (shared.kind !== "pglite") throw new Error("expected a PGlite handle");
    const query = vi.spyOn(shared.client, "query");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", checks: { database: "ok", "module-1": "ok" } });
    expect(query).toHaveBeenCalled();
  });

  it("checks the app's configured handle", async () => {
    let calls = 0;
    const handle = async () => {
      calls += 1;
      // The test database outlives this test: the handle's close leaves it open.
      return { ...(await createPgliteHandle(database.client)), close: () => Promise.resolve() };
    };
    registerSoftureConfig(createConfig({ databaseUrl: "postgresql://nobody:secret@127.0.0.1:1/none", databaseHandle: handle, ops: { detail: "checks" } }));
    const response = await GET();
    expect(await response.json()).toEqual({ status: "ok", checks: { database: "ok" } });
    expect(calls).toBe(1);
  });

  it("checks nothing but the modules when the app has no database", async () => {
    registerSoftureConfig(createConfig({ databaseUrl: null, modules: [passingCheck], ops: { detail: "checks" } }));
    expect(await (await GET()).json()).toEqual({ status: "ok", checks: { "module-1": "ok" } });
  });

  it("shares one run between concurrent requests", async () => {
    let runs = 0;
    const counted = () => {
      runs += 1;
      return new Promise<{ ok: true; value: undefined }>((resolve) => setTimeout(() => resolve({ ok: true, value: undefined }), 50));
    };
    registerSoftureConfig(createConfig({ databaseUrl: null, modules: [counted] }));
    const responses = await Promise.all([GET(), GET(), GET()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(runs).toBe(1);

    await GET();
    expect(runs).toBe(2);
  });

  it("throws a setup error when the ops module is not enabled", async () => {
    registerSoftureConfig(createConfig({ ops: null }));
    await expect(GET()).rejects.toThrow("the ops module is not enabled; add ops() to modules in softure.config.ts");
  });
});
