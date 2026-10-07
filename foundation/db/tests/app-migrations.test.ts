// The app's own migrations next to the module migrations (issue #153): `before` runs ahead of the
// module files, `after` behind them, both under the migration lock, on both drivers.
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { describeProblem, migrate, type AppMigrations, type DatabaseHandle, type MigrationResult } from "@softure-ai/db";
import { createFixtureModule, createLinkedModule, createNotesModule, getFixtureMigrationsUrl } from "./fixtures/modules.js";
import { createTestDrivers } from "./support/drivers.js";
import { execSql, hasRelation, queryRows, readLedger } from "./support/query.js";

const APP_DRIZZLE_FOLDER = fileURLToPath(new URL("./fixtures/app-drizzle/", import.meta.url));
const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function createAppUsers(handle: DatabaseHandle): Promise<void> {
  return execSql(handle, "CREATE TABLE IF NOT EXISTS public.app_users (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL)");
}

function createUserLinks(handle: DatabaseHandle): Promise<void> {
  return execSql(handle, "CREATE TABLE IF NOT EXISTS public.user_links (link_id integer NOT NULL REFERENCES linked.links (id))");
}

// The recipe the README gives: drizzle's own migrator for the handle's driver.
async function runDrizzleMigrations(handle: DatabaseHandle, migrationsFolder: string): Promise<void> {
  if (handle.kind === "postgres") {
    const { migrate: migrateApp } = await import("drizzle-orm/node-postgres/migrator");
    await migrateApp(handle.db, { migrationsFolder });
  } else {
    const { migrate: migrateApp } = await import("drizzle-orm/pglite/migrator");
    await migrateApp(handle.db, { migrationsFolder });
  }
}

function getProblems<T>(result: MigrationResult<T>) {
  if (result.ok) throw new Error("expected a failure");
  return result.problems;
}

function describeFirstProblem<T>(result: MigrationResult<T>): string {
  const [problem] = getProblems(result);
  if (problem === undefined) throw new Error("expected a problem");
  return describeProblem(problem);
}

describe.each(createTestDrivers())("app migrations on $name", (driver) => {
  afterEach(() => driver.cleanup());

  it("fails a module whose table references an app table when the app has not migrated", async () => {
    const handle = await driver.open();

    const result = await migrate(handle, { modules: [createLinkedModule()] });

    expect(getProblems(result)).toEqual([
      expect.objectContaining({ code: "db.migration_failed", module: "linked", version: 1, reason: 'relation "public.app_users" does not exist' }),
    ]);
  });

  it("runs before ahead of the module files and after behind them", async () => {
    const handle = await driver.open();
    const calls: string[] = [];
    const app: AppMigrations = {
      before: async (received) => {
        calls.push(`before, linked.links exists: ${String(await hasRelation(received, "linked.links"))}`);
        await createAppUsers(received);
      },
      after: async (received) => {
        calls.push(`after, linked.links exists: ${String(await hasRelation(received, "linked.links"))}`);
        await createUserLinks(received);
      },
    };

    const result = await migrate(handle, { modules: [createLinkedModule()], app });

    expect(result.ok && result.value).toEqual({
      applied: [
        expect.objectContaining({ module: "softure", version: 1 }),
        expect.objectContaining({ module: "linked", version: 1, name: "create_links" }),
      ],
      app: ["before", "after"],
    });
    expect(calls).toEqual(["before, linked.links exists: false", "after, linked.links exists: true"]);
    expect(await hasRelation(handle, "public.user_links")).toBe(true);
  });

  it("runs the hooks on every run, also when no module file is pending", async () => {
    const handle = await driver.open();
    const calls: string[] = [];
    const app: AppMigrations = {
      before: async (received) => {
        calls.push("before");
        await createAppUsers(received);
      },
      after: () => {
        calls.push("after");
        return Promise.resolve();
      },
    };
    await migrate(handle, { modules: [createLinkedModule()], app });

    const second = await migrate(handle, { modules: [createLinkedModule()], app });

    expect(second).toEqual({ ok: true, value: { applied: [], app: ["before", "after"] } });
    expect(calls).toEqual(["before", "after", "before", "after"]);
  });

  it("stops before any module file when before fails, and reports the cause chain", async () => {
    const handle = await driver.open();
    let afterCalled = false;
    const app: AppMigrations = {
      before: () => Promise.reject(new Error("Failed query: create table x", { cause: new Error('relation "y" does not exist') })),
      after: () => {
        afterCalled = true;
        return Promise.resolve();
      },
    };

    const result = await migrate(handle, { modules: [createNotesModule()], app });

    expect(getProblems(result)).toEqual([
      { code: "db.app_migration_failed", phase: "before", reason: 'Failed query: create table x: relation "y" does not exist' },
    ]);
    expect(describeFirstProblem(result)).toBe(
      'app: the before migrations failed: Failed query: create table x: relation "y" does not exist; no module migration ran',
    );
    expect(afterCalled).toBe(false);
    expect((await readLedger(handle)).map((row) => row.module)).toEqual(["softure"]);
  });

  it("keeps the module files applied when after fails", async () => {
    const handle = await driver.open();
    const app: AppMigrations = { after: () => Promise.reject(new Error("boom")) };

    const result = await migrate(handle, { modules: [createNotesModule()], app });

    expect(getProblems(result)).toEqual([{ code: "db.app_migration_failed", phase: "after", reason: "boom" }]);
    expect(describeFirstProblem(result)).toBe("app: the after migrations failed: boom; the module migrations before it stay applied");
    expect((await readLedger(handle)).map((row) => `${row.module}/${row.version}`)).toEqual(["softure/1", "notes/1", "notes/2"]);
  });

  it("calls no hook when the run is refused", async () => {
    const handle = await driver.open();
    const calls: string[] = [];
    const app: AppMigrations = {
      before: () => {
        calls.push("before");
        return Promise.resolve();
      },
    };

    const result = await migrate(handle, { modules: [createFixtureModule({ id: "drizzle", migrationsDir: getFixtureMigrationsUrl("notes") })], app });

    expect(getProblems(result)).toEqual([{ code: "db.reserved_module", module: "drizzle" }]);
    expect(calls).toEqual([]);
  });

  it("refuses a module whose schema is drizzle's ledger schema", async () => {
    const handle = await driver.open();

    const result = await migrate(handle, { modules: [createFixtureModule({ id: "ledgers", dbSchema: "drizzle", migrationsDir: getFixtureMigrationsUrl("notes") })] });

    expect(getProblems(result)).toEqual([{ code: "db.reserved_module", module: "ledgers" }]);
    expect(describeFirstProblem(result)).toContain("drizzle");
  });

  it("runs the app's drizzle migrations in before, once, with drizzle's own ledger", async () => {
    const handle = await driver.open();
    const app: AppMigrations = { before: (received) => runDrizzleMigrations(received, APP_DRIZZLE_FOLDER) };

    const first = await migrate(handle, { modules: [createLinkedModule()], app });
    const second = await migrate(handle, { modules: [createLinkedModule()], app });

    expect([first.ok, second.ok]).toEqual([true, true]);
    expect(await hasRelation(handle, "linked.links")).toBe(true);
    expect(await queryRows(handle, "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).toEqual([{ count: 1 }]);
  });

  it("reports the database error of a broken drizzle file, not only drizzle's wrapper", async () => {
    const handle = await driver.open();
    const root = mkdtempSync(join(tmpdir(), "softure-db-app-drizzle-"));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    cpSync(APP_DRIZZLE_FOLDER, root, { recursive: true });
    writeFileSync(join(root, "0000_app_users.sql"), 'CREATE TABLE "app_users" ("id" integer PRIMARY KEY REFERENCES "missing_table" ("id"));\n');
    const app: AppMigrations = { before: (received) => runDrizzleMigrations(received, root) };

    const result = await migrate(handle, { modules: [createLinkedModule()], app });

    const [problem] = getProblems(result);
    expect(problem).toMatchObject({ code: "db.app_migration_failed", phase: "before" });
    expect(problem?.code === "db.app_migration_failed" && problem.reason).toContain('relation "missing_table" does not exist');
  });
});
