import { appendFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDatabase,
  describeProblem,
  migrate,
  planMigrations,
  type DatabaseHandle,
  type MigrationProblem,
  type MigrationResult,
} from "@softure-ai/db";
import { LEDGER_FILES } from "../src/migrations/ledger.js";
import { applyFile } from "../src/migrations/migrator.js";
import { withSession } from "../src/migrations/session.js";
import { computeChecksum } from "../src/migrations/files.js";
import { copyFixtureMigrations, createFixtureModule, createNotesModule, createTagsModule } from "./fixtures/modules.js";
import { createTestDrivers } from "./support/drivers.js";
import { POSTGRES_ADMIN_URL, createPostgresDatabaseUrl } from "./support/postgres.js";
import { execSql, hasRelation, hasSchema, queryRows, readLedger } from "./support/query.js";

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function copyFolder(id: "notes" | "tags") {
  const copy = copyFixtureMigrations(id);
  cleanups.push(copy.cleanup);
  return copy;
}

function getProblems<T>(result: MigrationResult<T>) {
  if (result.ok) throw new Error("expected a failure");
  return result.problems;
}

function getFirstProblem<T>(result: MigrationResult<T>): MigrationProblem {
  const [problem] = getProblems(result);
  if (problem === undefined) throw new Error("expected a problem");
  return problem;
}

describe("the ledger migration", () => {
  it("never changes: deployed databases hold its checksum", () => {
    // Do not update this value. Change the ledger with a new file (0002_…) in ledger.ts.
    expect(LEDGER_FILES.map((file) => [file.fileName, file.checksum])).toEqual([
      ["0001_ledger.sql", "87228c3c51cf59b164d95ee4bbca3115b1ddf7d83d6fbc82e4609a3c58678c71"],
    ]);
  });
});

describe.each(createTestDrivers())("migrator on $name", (driver) => {
  afterEach(() => driver.cleanup());

  it("applies two modules in dependency order, each in its own schema", async () => {
    const handle = await driver.open();
    // Listed dependent first: the migrator must still run notes before tags (FK to notes.notes).
    const modules = [createTagsModule(), createNotesModule()];

    const result = await migrate(handle, { modules });

    expect(result.ok).toBe(true);
    expect(await readLedger(handle)).toEqual([
      { module: "softure", version: 1, name: "ledger", method: "applied" },
      { module: "notes", version: 1, name: "create_notes", method: "applied" },
      { module: "notes", version: 2, name: "add_notes_title_index", method: "applied" },
      { module: "tags", version: 1, name: "create_tags", method: "applied" },
    ]);
    expect(await hasRelation(handle, "notes.notes")).toBe(true);
    expect(await hasRelation(handle, "notes.notes_title_idx")).toBe(true);
    expect(await hasRelation(handle, "tags.tags")).toBe(true);
    expect(await hasRelation(handle, "public.notes")).toBe(false);
  });

  it("reports each applied step and returns them in order", async () => {
    const handle = await driver.open();
    const seen: string[] = [];

    const result = await migrate(handle, {
      modules: [createNotesModule()],
      onApplied: (step) => seen.push(`${step.module}/${step.version}`),
    });

    expect(result.ok && result.value.applied.map((step) => `${step.module}/${step.version}`)).toEqual(seen);
    expect(seen).toEqual(["softure/1", "notes/1", "notes/2"]);
  });

  it("does nothing on a second run", async () => {
    const handle = await driver.open();
    const modules = [createNotesModule(), createTagsModule()];
    await migrate(handle, { modules });
    const before = await readLedger(handle);

    const second = await migrate(handle, { modules });

    expect(second).toEqual({ ok: true, value: { applied: [], adopted: [], app: [] } });
    expect(await readLedger(handle)).toEqual(before);
  });

  it("plans everything on an empty database without creating anything", async () => {
    const handle = await driver.open();

    const plan = await planMigrations(handle, { modules: [createTagsModule(), createNotesModule()] });

    expect(plan.ok && plan.value.pending.map((step) => `${step.schema}/${step.version}_${step.name}`)).toEqual([
      "softure/1_ledger",
      "notes/1_create_notes",
      "notes/2_add_notes_title_index",
      "tags/1_create_tags",
    ]);
    expect(await hasSchema(handle, "softure")).toBe(false);
    expect(await hasSchema(handle, "notes")).toBe(false);
  });

  it("refuses an edited applied migration, in any module, before running anything", async () => {
    const handle = await driver.open();
    const tags = copyFolder("tags");
    await migrate(handle, { modules: [createNotesModule(), createTagsModule(tags.dir)] });
    appendFileSync(join(tags.path, "0001_create_tags.sql"), "-- edited\n");
    const notes = copyFolder("notes");
    writeFileSync(join(notes.path, "0003_add_notes_body.sql"), "-- Rollback: ALTER TABLE notes.notes DROP COLUMN body;\nALTER TABLE notes ADD COLUMN body text;\n");
    const modules = [createNotesModule(notes.dir), createTagsModule(tags.dir)];

    const result = await migrate(handle, { modules });

    expect(getProblems(result)).toEqual([{ code: "db.migration_changed", module: "tags", version: 1, name: "create_tags" }]);
    expect(describeProblem(getFirstProblem(result))).toContain("0001_create_tags.sql was edited");
    expect(await queryRows(handle, "SELECT 1 FROM information_schema.columns WHERE table_schema = 'notes' AND column_name = 'body'")).toEqual([]);
    expect(getProblems(await planMigrations(handle, { modules }))[0]?.code).toBe("db.migration_changed");
  });

  it("refuses a renamed applied migration", async () => {
    const handle = await driver.open();
    const notes = copyFolder("notes");
    await migrate(handle, { modules: [createNotesModule(notes.dir)] });
    renameSync(join(notes.path, "0002_add_notes_title_index.sql"), join(notes.path, "0002_index_titles.sql"));

    const result = await migrate(handle, { modules: [createNotesModule(notes.dir)] });

    expect(getProblems(result)).toEqual([{ code: "db.migration_changed", module: "notes", version: 2, name: "add_notes_title_index" }]);
  });

  it("refuses when an applied migration was deleted", async () => {
    const handle = await driver.open();
    const notes = copyFolder("notes");
    await migrate(handle, { modules: [createNotesModule(notes.dir)] });
    rmSync(join(notes.path, "0002_add_notes_title_index.sql"));

    const result = await migrate(handle, { modules: [createNotesModule(notes.dir)] });

    expect(getProblems(result)).toEqual([{ code: "db.migration_missing", module: "notes", version: 2, name: "add_notes_title_index" }]);
  });

  it("applies only a newly added migration", async () => {
    const handle = await driver.open();
    const notes = copyFolder("notes");
    await migrate(handle, { modules: [createNotesModule(notes.dir)] });
    writeFileSync(join(notes.path, "0003_add_notes_body.sql"), "-- Rollback: ALTER TABLE notes.notes DROP COLUMN body;\nALTER TABLE notes ADD COLUMN body text;\n");

    const result = await migrate(handle, { modules: [createNotesModule(notes.dir)] });

    expect(result.ok && result.value.applied.map((step) => step.name)).toEqual(["add_notes_body"]);
    expect(await queryRows(handle, "SELECT column_name FROM information_schema.columns WHERE table_schema = 'notes' AND column_name = 'body'")).toEqual([
      { column_name: "body" },
    ]);
  });

  it("refuses a pending migration numbered below an applied one", async () => {
    const handle = await driver.open();
    const notes = copyFolder("notes");
    writeFileSync(join(notes.path, "0003_add_notes_body.sql"), "-- Rollback: ALTER TABLE notes.notes DROP COLUMN body;\nALTER TABLE notes ADD COLUMN body text;\n");
    await migrate(handle, { modules: [createNotesModule(notes.dir)] });
    // As if 0002 had been inserted into a module release after the database already ran 0003.
    await execSql(handle, "DELETE FROM softure.migrations WHERE module = 'notes' AND version = 2");

    const result = await planMigrations(handle, { modules: [createNotesModule(notes.dir)] });

    expect(getProblems(result)).toEqual([{ code: "db.migration_out_of_order", module: "notes", version: 2, appliedVersion: 3 }]);
  });

  it("keeps the files before a failing one and rolls the failing one back completely", async () => {
    const handle = await driver.open();
    const notes = copyFolder("notes");
    writeFileSync(
      join(notes.path, "0003_broken.sql"),
      "-- Rollback: nothing to undo.\nCREATE TABLE half_done (id int);\nALTER TABLE notes ADD COLUMN body text;\nSELECT 1 / 0;\n",
    );

    const result = await migrate(handle, { modules: [createNotesModule(notes.dir)] });

    expect(getProblems(result)).toEqual([
      { code: "db.migration_failed", module: "notes", version: 3, name: "broken", reason: "division by zero" },
    ]);
    expect((await readLedger(handle)).map((row) => `${row.module}/${row.version}`)).toEqual(["softure/1", "notes/1", "notes/2"]);
    expect(await hasRelation(handle, "notes.half_done")).toBe(false);
    expect(await queryRows(handle, "SELECT 1 FROM information_schema.columns WHERE table_schema = 'notes' AND column_name = 'body'")).toEqual([]);
    // The session is usable again: a fixed file applies on the next run.
    writeFileSync(join(notes.path, "0003_broken.sql"), "-- Rollback: nothing to undo.\nSELECT 1;\n");
    expect((await migrate(handle, { modules: [createNotesModule(notes.dir)] })).ok).toBe(true);
  });

  it("does not call a file rolled back when it ended the transaction itself", async () => {
    const handle = await driver.open();
    await migrate(handle, { modules: [] });
    // Bypasses the file check on purpose: the runner's own guard must still notice.
    const sql = "CREATE TABLE committed_early (id int);\nCOMMIT;\nCREATE TABLE after_commit (id int);\n";
    const file = { version: 1, name: "sneaky", fileName: "0001_sneaky.sql", sql, checksum: computeChecksum(sql) };
    const unit = { module: "sneaky", schema: "sneaky", moduleVersion: "0.1.0", files: [file] };

    const problem = await withSession(handle, (session) => applyFile(session, { unit, file, method: "applied" }));

    expect(problem).toEqual({
      code: "db.migration_failed",
      module: "sneaky",
      version: 1,
      name: "sneaky",
      reason: "the file ended the migrator's transaction, so the statements before that point may be committed; check the schema by hand",
    });
    expect(await readLedger(handle)).toEqual([{ module: "softure", version: 1, name: "ledger", method: "applied" }]);
  });

  it("notices an ended transaction every time, even when the next one starts within the same clock tick", async () => {
    const handle = await driver.open();
    await migrate(handle, { modules: [] });
    // PGlite's clock ticks in milliseconds, so two transactions often share now(); 50 runs made the
    // old now()-based guard miss at least once (the 0.1.2 release of billing failed on it).
    const sql = "COMMIT;\nSELECT 1;\n";
    const file = { version: 1, name: "fast", fileName: "0001_fast.sql", sql, checksum: computeChecksum(sql) };
    const unit = { module: "fast", schema: "fast", moduleVersion: "0.1.0", files: [file] };

    const problems = [];
    for (let attempt = 0; attempt < 50; attempt += 1) {
      problems.push(await withSession(handle, (session) => applyFile(session, { unit, file, method: "applied" })));
    }

    expect(problems.filter((problem) => problem === null)).toEqual([]);
    expect(await readLedger(handle)).toEqual([{ module: "softure", version: 1, name: "ledger", method: "applied" }]);
  });

  it.each([
    ["the ledger id", { id: "softure", dbSchema: "softure_data" }],
    ["the ledger schema", { id: "ledgerish", dbSchema: "softure" }],
    ["the public schema", { id: "app-tables", dbSchema: "public" }],
    ["information_schema", { id: "meta", dbSchema: "information_schema" }],
    ["a pg_ schema", { id: "catalog", dbSchema: "pg_things" }],
    ["a schema over 63 bytes", { id: "long", dbSchema: `s${"x".repeat(63)}` }],
  ])("refuses %s without touching the database", async (_label, spec) => {
    const handle = await driver.open();

    const result = await migrate(handle, { modules: [createFixtureModule({ ...spec, migrationsDir: copyFolder("notes").dir })] });

    expect(getProblems(result)).toEqual([{ code: "db.reserved_module", module: spec.id }]);
    expect(await hasSchema(handle, "softure")).toBe(false);
  });

  it("refuses a module with migrations but no schema", async () => {
    const handle = await driver.open();
    const module = createFixtureModule({ id: "loose", dbSchema: null, migrationsDir: copyFolder("notes").dir });

    expect(getProblems(await migrate(handle, { modules: [module] }))).toEqual([{ code: "db.migrations_without_schema", module: "loose" }]);
  });

  it("refuses a dependency cycle", async () => {
    const handle = await driver.open();
    const first = createFixtureModule({ id: "first", dependsOn: { second: "*" }, migrationsDir: copyFolder("notes").dir });
    const second = createFixtureModule({ id: "second", dependsOn: { first: "*" }, migrationsDir: copyFolder("tags").dir });

    expect(getProblems(await migrate(handle, { modules: [first, second] }))).toEqual([{ code: "db.dependency_cycle", modules: ["first", "second"] }]);
  });

  it("reports every invalid file of every module at once", async () => {
    const handle = await driver.open();
    const notes = copyFolder("notes");
    const tags = copyFolder("tags");
    writeFileSync(join(notes.path, "0003_no_note.sql"), "SELECT 1;\n");
    writeFileSync(join(tags.path, "0002_commits.sql"), "-- Rollback: none.\nCOMMIT;\n");

    const problems = getProblems(await migrate(handle, { modules: [createNotesModule(notes.dir), createTagsModule(tags.dir)] }));

    expect(problems.map((problem) => problem.code === "db.invalid_migration_file" && `${problem.module}/${problem.file}`)).toEqual([
      "notes/0003_no_note.sql",
      "tags/0002_commits.sql",
    ]);
    expect(await hasSchema(handle, "softure")).toBe(false);
  });

  it("reads module files from a migrations folder instead of the module folder", async () => {
    const handle = await driver.open();
    const notes = copyFolder("notes");
    // `<dir>/notes/` is the layout `exportMigrations` writes for a container image.
    const root = new URL("../", notes.dir);
    renameSync(notes.path, join(notes.path, "..", "notes"));
    const module = createNotesModule(new URL("file:///nowhere/"));

    const result = await migrate(handle, { modules: [module], migrationsDir: root });

    expect(result.ok && result.value.applied.map((step) => `${step.module}/${step.version}`)).toEqual(["softure/1", "notes/1", "notes/2"]);
  });
});

describe.runIf(POSTGRES_ADMIN_URL !== undefined)("migrator on a shared Postgres", () => {
  const handles: DatabaseHandle[] = [];
  afterEach(async () => {
    for (const handle of handles.splice(0)) await handle.close();
  });

  async function openTwice(): Promise<[DatabaseHandle, DatabaseHandle]> {
    const { url, drop } = await createPostgresDatabaseUrl();
    cleanups.push(drop);
    const first = await createDatabase(url);
    const second = await createDatabase(url);
    handles.push(first, second);
    return [first, second];
  }

  it("lets two concurrent runners apply each file exactly once", async () => {
    const [first, second] = await openTwice();
    const notes = copyFolder("notes");
    // Holds the lock long enough that the second runner provably waits for it.
    writeFileSync(join(notes.path, "0003_slow.sql"), "-- Rollback: nothing to undo.\nSELECT pg_sleep(0.5);\n");
    const modules = [createNotesModule(notes.dir), createTagsModule()];

    const [one, two] = await Promise.all([migrate(first, { modules }), migrate(second, { modules })]);

    const appliedCounts = [one, two].map((result) => (result.ok ? result.value.applied.length : -1)).sort();
    expect(appliedCounts).toEqual([0, 5]);
    expect(await readLedger(first)).toHaveLength(5);
  });

  it("survives a connection lost in the middle of a run", async () => {
    const [handle, other] = await openTwice();
    const notes = copyFolder("notes");
    writeFileSync(join(notes.path, "0003_lose_connection.sql"), "-- Rollback: nothing to undo.\nSELECT pg_terminate_backend(pg_backend_pid());\n");

    const attempt = await migrate(handle, { modules: [createNotesModule(notes.dir)] }).then(
      (result) => (result.ok ? "applied" : result.error),
      (error: unknown) => (error instanceof Error ? "thrown" : "unknown"),
    );

    expect(["db.migration_failed", "thrown"]).toContain(attempt);
    expect((await readLedger(other)).map((row) => `${row.module}/${row.version}`)).toEqual(["softure/1", "notes/1", "notes/2"]);
    // The pool still works: the lock was released with the dead connection.
    expect((await planMigrations(handle, { modules: [createNotesModule(notes.dir)] })).ok).toBe(true);
  });

  it("does not leak a SET from a migration file into later pooled queries", async () => {
    const [handle] = await openTwice();
    const notes = copyFolder("notes");
    writeFileSync(join(notes.path, "0003_set_path.sql"), "-- Rollback: nothing to undo.\nSET search_path TO notes;\n");

    await migrate(handle, { modules: [createNotesModule(notes.dir)] });
    const paths = await Promise.all(
      Array.from({ length: 5 }, () => queryRows<{ search_path: string }>(handle, "SHOW search_path")),
    );

    expect(paths.flat().map((row) => row.search_path)).toEqual(Array(5).fill('"$user", public'));
  });
});
