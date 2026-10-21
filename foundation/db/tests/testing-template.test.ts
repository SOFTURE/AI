import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppMigrations } from "@softure-ai/db";
import { TEMPLATE_DIR_VARIABLE, type TestDatabase } from "@softure-ai/db/testing";
import setupTemplates from "@softure-ai/db/testing/global-setup";
import { execSql } from "./support/query.js";
import { copyFixtureMigrations, createLinkedModule, createNotesModule } from "./fixtures/modules.js";

type Testing = typeof import("@softure-ai/db/testing");

let dir: string;
const opened: TestDatabase[] = [];
const cleanups: (() => void)[] = [];

// A new module instance, as Vitest gives every test file: nothing cached in memory.
async function importFreshTesting(): Promise<Testing> {
  vi.resetModules();
  return import("@softure-ai/db/testing");
}

async function open(testing: Testing, ...args: Parameters<Testing["createTestDatabase"]>): Promise<TestDatabase> {
  const database = await testing.createTestDatabase(...args);
  opened.push(database);
  return database;
}

function listTemplates(): string[] {
  return readdirSync(dir).filter((file) => file.endsWith(".tar"));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-db-template-test-"));
  vi.stubEnv(TEMPLATE_DIR_VARIABLE, dir);
});

afterEach(async () => {
  for (const database of opened.splice(0)) await database.close();
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("createTestDatabase with a run-wide template folder", () => {
  it("migrates a module set once and loads it from the folder in another file", async () => {
    let runs = 0;
    const app: AppMigrations = {
      before: async (handle) => {
        runs += 1;
        await execSql(handle, "CREATE TABLE public.app_users (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL)");
      },
    };

    const first = await open(await importFreshTesting(), [createLinkedModule()], { app, templateKey: "app-users-1" });
    const second = await open(await importFreshTesting(), [createLinkedModule()], { app, templateKey: "app-users-1" });
    const rows = await second.db.execute<{ count: number }>(sql`select count(*)::int as count from linked.links`);

    expect(runs).toBe(1);
    expect(listTemplates()).toHaveLength(1);
    expect(rows.rows).toEqual([{ count: 0 }]);
    expect(first.client).not.toBe(second.client);
  });

  it("stores another template when a migration file changes", async () => {
    const copy = copyFixtureMigrations("notes");
    cleanups.push(copy.cleanup);

    await open(await importFreshTesting(), [createNotesModule(copy.dir)]);
    writeFileSync(join(copy.path, "0003_add_body.sql"), "-- Rollback: ALTER TABLE notes.notes DROP COLUMN body;\nALTER TABLE notes ADD COLUMN body text;\n");
    const changed = await open(await importFreshTesting(), [createNotesModule(copy.dir)]);
    const columns = await changed.db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns where table_schema = 'notes' and table_name = 'notes' and column_name = 'body'`,
    );

    expect(listTemplates()).toHaveLength(2);
    expect(columns.rows).toEqual([{ column_name: "body" }]);
  });

  it("identifies drizzle hooks by their files, without a templateKey", async () => {
    const openWithDrizzle = async (): Promise<TestDatabase> => {
      const testing = await importFreshTesting();
      // From the same module instance as `testing`, as in a test file.
      const { drizzleAppMigrations } = await import("@softure-ai/db");
      return open(testing, [createLinkedModule()], { app: { before: drizzleAppMigrations(new URL("./fixtures/app-drizzle/", import.meta.url)) } });
    };

    await openWithDrizzle();
    const second = await openWithDrizzle();
    const rows = await second.db.execute<{ count: number }>(sql`select count(*)::int as count from public.app_users`);

    expect(listTemplates()).toHaveLength(1);
    expect(rows.rows).toEqual([{ count: 0 }]);
  });

  it("keeps a custom hook without templateKey per file and writes nothing", async () => {
    let runs = 0;
    const app: AppMigrations = {
      before: async (handle) => {
        runs += 1;
        await execSql(handle, "CREATE TABLE public.app_users (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL)");
      },
    };

    await open(await importFreshTesting(), [createLinkedModule()], { app });
    await open(await importFreshTesting(), [createLinkedModule()], { app });

    expect(runs).toBe(2);
    expect(listTemplates()).toEqual([]);
  });

  it("writes nothing without the folder", async () => {
    vi.stubEnv(TEMPLATE_DIR_VARIABLE, "");

    await open(await importFreshTesting(), [createNotesModule()]);

    expect(listTemplates()).toEqual([]);
  });

  it("stores no template when the migrations fail", async () => {
    const copy = copyFixtureMigrations("notes");
    cleanups.push(copy.cleanup);
    writeFileSync(join(copy.path, "0003_broken.sql"), "-- Rollback: nothing.\nSELECT * FROM missing_table;\n");

    await expect((await importFreshTesting()).createTestDatabase([createNotesModule(copy.dir)])).rejects.toThrow(/0003_broken\.sql failed/);
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe("the global setup", () => {
  it("gives the run a folder and removes it at the end", async () => {
    vi.stubEnv(TEMPLATE_DIR_VARIABLE, undefined);

    const teardown = await setupTemplates();
    const created = process.env[TEMPLATE_DIR_VARIABLE] ?? "";
    const existedDuringRun = existsSync(created);
    await teardown();

    expect(created).not.toBe("");
    expect(existedDuringRun).toBe(true);
    expect(existsSync(created)).toBe(false);
    expect(process.env[TEMPLATE_DIR_VARIABLE]).toBeUndefined();
  });

  it("keeps a folder the app named itself", async () => {
    const teardown = await setupTemplates();
    await teardown();

    expect(process.env[TEMPLATE_DIR_VARIABLE]).toBe(dir);
    expect(existsSync(dir)).toBe(true);
  });
});
