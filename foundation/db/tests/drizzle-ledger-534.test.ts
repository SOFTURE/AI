// Issue #534: drizzle's migrator reads only the newest row of its ledger, so an `after` drizzle folder sharing the
// `before` folder's ledger skips every file older than the newest `before` file. `drizzleAppMigrations` takes its own
// ledger, and `migrate` / `planMigrations` refuse two drizzle hooks on one ledger before anything runs.
import { afterEach, describe, expect, it } from "vitest";
import { describeProblem, drizzleAppMigrations, migrate, planMigrations, type AppMigrations, type MigrationResult } from "@softure-ai/db";
import { createTestDrivers } from "./support/drivers.js";
import { hasRelation, hasSchema, queryRows } from "./support/query.js";

// `app-drizzle-after`'s only file is a day older than `app-drizzle`'s, as after a regular migration added later.
const BEFORE_FOLDER = new URL("./fixtures/app-drizzle/", import.meta.url);
const AFTER_FOLDER = new URL("./fixtures/app-drizzle-after/", import.meta.url);

function getProblems<T>(result: MigrationResult<T>) {
  if (result.ok) throw new Error("expected a failure");
  return result.problems;
}

describe.each(createTestDrivers())("drizzle app migrations on separate ledgers on $name", (driver) => {
  afterEach(() => driver.cleanup());

  it("applies an after folder older than the before folder when it has its own ledger", async () => {
    const handle = await driver.open();
    const app: AppMigrations = {
      before: drizzleAppMigrations(BEFORE_FOLDER),
      after: drizzleAppMigrations(AFTER_FOLDER, { migrationsTable: "__drizzle_migrations_after" }),
    };

    const result = await migrate(handle, { modules: [], app });

    expect(result.ok && result.value.app).toEqual(["before", "after"]);
    expect(await hasRelation(handle, "public.app_users")).toBe(true);
    expect(await hasRelation(handle, "public.app_notes")).toBe(true);
    expect(await queryRows(handle, "select created_at::text from drizzle.__drizzle_migrations")).toEqual([{ created_at: "1791331200000" }]);
    expect(await queryRows(handle, "select created_at::text from drizzle.__drizzle_migrations_after")).toEqual([{ created_at: "1791244800000" }]);
  });

  it("applies nothing on a second run", async () => {
    const handle = await driver.open();
    const app: AppMigrations = {
      before: drizzleAppMigrations(BEFORE_FOLDER),
      after: drizzleAppMigrations(AFTER_FOLDER, { migrationsSchema: "app_ledger", migrationsTable: "after_migrations" }),
    };
    await migrate(handle, { modules: [], app });

    const second = await migrate(handle, { modules: [], app });

    expect(second.ok).toBe(true);
    expect(await queryRows(handle, "select count(*)::int as n from app_ledger.after_migrations")).toEqual([{ n: 1 }]);
    expect(await queryRows(handle, "select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([{ n: 1 }]);
  });

  it("refuses before and after on the default ledger and runs nothing", async () => {
    const handle = await driver.open();
    const app: AppMigrations = { before: drizzleAppMigrations(BEFORE_FOLDER), after: drizzleAppMigrations(AFTER_FOLDER) };

    const result = await migrate(handle, { modules: [], app });

    expect(getProblems(result)).toEqual([{ code: "db.app_migrations_shared_ledger", ledger: "drizzle.__drizzle_migrations" }]);
    expect(await hasRelation(handle, "public.app_users")).toBe(false);
    expect(await hasSchema(handle, "drizzle")).toBe(false);
  });

  it("refuses two hooks naming the same ledger, in a plan too", async () => {
    const handle = await driver.open();
    const ledger = { migrationsSchema: "app_ledger", migrationsTable: "migrations" };
    const app: AppMigrations = { before: drizzleAppMigrations(BEFORE_FOLDER, ledger), after: drizzleAppMigrations(AFTER_FOLDER, ledger) };

    const result = await planMigrations(handle, { modules: [], app });

    expect(getProblems(result)).toEqual([{ code: "db.app_migrations_shared_ledger", ledger: "app_ledger.migrations" }]);
  });
});

describe("describeProblem for a shared drizzle ledger", () => {
  it("names the ledger and the option that separates it", () => {
    expect(describeProblem({ code: "db.app_migrations_shared_ledger", ledger: "drizzle.__drizzle_migrations" })).toBe(
      "app: the before and after drizzle migrations share the ledger drizzle.__drizzle_migrations, so drizzle would skip " +
        "every after file older than the newest before file; give the after folder its own ledger " +
        '(drizzleAppMigrations(folder, { migrationsTable: "__drizzle_migrations_after" }))',
    );
  });
});
