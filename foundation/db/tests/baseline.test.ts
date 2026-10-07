// Adoption baselines (issue #152): an app whose own migration history recreates a module's tables
// declares `app.baseline`, so every fresh database adopts files 1..N and migrates the rest by itself.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, planMigrations, type AppMigrations, type DatabaseHandle, type MigrationResult } from "@softure-ai/db";
import { copyFixtureMigrations, createFixtureModule, createNotesModule, createNotesWithNewDependency } from "./fixtures/modules.js";
import { createTestDrivers } from "./support/drivers.js";
import { execSql, queryRows, readLedger } from "./support/query.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

// The app's own history: a `notes` table in `public` with data, moved into the module's schema,
// shaped like the module's files 0001 and 0002. Idempotent, as an app's migrator is.
const APP_NOTES = `
  CREATE SCHEMA IF NOT EXISTS notes;
  DO $$ BEGIN
    IF to_regclass('notes.notes') IS NULL THEN
      CREATE TABLE public.notes (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        title text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX notes_title_idx ON public.notes (title);
      INSERT INTO public.notes (title) VALUES ('first'), ('second');
      ALTER TABLE public.notes SET SCHEMA notes;
    END IF;
  END $$;
`;

// The same history without the index (it matches file 0001 only).
const APP_NOTES_WITHOUT_INDEX = `
  CREATE SCHEMA IF NOT EXISTS notes;
  CREATE TABLE IF NOT EXISTS notes.notes (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`;

const NOTES_BODY = "-- Rollback: ALTER TABLE notes.notes DROP COLUMN body;\nALTER TABLE notes ADD COLUMN body text;\n";

function createApp(sql: string, extra: Partial<AppMigrations> = {}): AppMigrations {
  return { before: (handle) => execSql(handle, sql), ...extra };
}

function getCodes<T>(result: MigrationResult<T>): string[] {
  if (result.ok) throw new Error("expected a failure");
  return result.problems.map((problem) => problem.code);
}

function formatLedger(rows: readonly { module: string; version: number; method: string }[]): string[] {
  return rows.map((row) => `${row.module}/${row.version}/${row.method}`);
}

/** `notes` 0001–0002 plus 0003 (a new column), as a module that shipped a later migration. */
function createUpgradedNotes() {
  const copy = copyFixtureMigrations("notes");
  cleanups.push(copy.cleanup);
  writeFileSync(join(copy.path, "0003_add_notes_body.sql"), NOTES_BODY);
  return createNotesModule(copy.dir);
}

function createNotesWithExtras() {
  const fixture = createNotesWithNewDependency();
  cleanups.push(fixture.cleanup);
  return fixture.modules;
}

describe.each(createTestDrivers())("migrate with a baseline on $name", (driver) => {
  afterEach(() => driver.cleanup());

  async function open(): Promise<DatabaseHandle> {
    return driver.open();
  }

  it("adopts the files the app's history creates on a fresh database, keeps the data, then has nothing to do", async () => {
    const handle = await open();
    const app = createApp(APP_NOTES, { baseline: { notes: 2 } });
    const adoptedSteps: string[] = [];

    const first = await migrate(handle, { modules: [createNotesModule()], app, onAdopted: (step) => adoptedSteps.push(step.name) });
    const second = await migrate(handle, { modules: [createNotesModule()], app });

    expect(first.ok && first.value).toMatchObject({
      applied: [{ module: "softure", version: 1 }],
      adopted: [{ module: "notes", version: 1 }, { module: "notes", version: 2 }],
      app: ["before"],
    });
    expect(adoptedSteps).toEqual(["create_notes", "add_notes_title_index"]);
    expect(second.ok && second.value).toMatchObject({ applied: [], adopted: [] });
    expect(formatLedger(await readLedger(handle))).toEqual(["softure/1/applied", "notes/1/adopted", "notes/2/adopted"]);
    expect(await queryRows(handle, "SELECT title FROM notes.notes ORDER BY id")).toEqual([{ title: "first" }, { title: "second" }]);
  });

  it("adopts the baseline and applies the files the module shipped after it", async () => {
    const handle = await open();

    const result = await migrate(handle, { modules: [createUpgradedNotes()], app: createApp(APP_NOTES, { baseline: { notes: 2 } }) });

    expect(result.ok && result.value.applied.map((step) => `${step.module}/${step.version}`)).toEqual(["softure/1", "notes/3"]);
    expect(formatLedger(await readLedger(handle))).toEqual(["softure/1/applied", "notes/1/adopted", "notes/2/adopted", "notes/3/applied"]);
    expect(await queryRows(handle, "SELECT title, body FROM notes.notes ORDER BY id")).toEqual([
      { title: "first", body: null },
      { title: "second", body: null },
    ]);
  });

  it("adopts a shorter baseline and migrates the files after it", async () => {
    const handle = await open();

    const result = await migrate(handle, { modules: [createNotesModule()], app: createApp(APP_NOTES_WITHOUT_INDEX, { baseline: { notes: 1 } }) });

    expect(result.ok).toBe(true);
    expect(formatLedger(await readLedger(handle))).toEqual(["softure/1/applied", "notes/1/adopted", "notes/2/applied"]);
  });

  it("migrates normally when the app's history left the module's schema empty", async () => {
    const handle = await open();

    const result = await migrate(handle, { modules: [createNotesModule()], app: createApp("CREATE SCHEMA IF NOT EXISTS notes", { baseline: { notes: 2 } }) });

    expect(result.ok && result.value.adopted).toEqual([]);
    expect(formatLedger(await readLedger(handle))).toEqual(["softure/1/applied", "notes/1/applied", "notes/2/applied"]);
  });

  it("refuses a baseline the schema does not match, records nothing for the module and skips after", async () => {
    const handle = await open();
    const calls: string[] = [];
    const app = createApp(APP_NOTES_WITHOUT_INDEX, { baseline: { notes: 2 }, after: () => { calls.push("after"); return Promise.resolve(); } });

    const result = await migrate(handle, { modules: [createNotesModule()], app });

    expect(getCodes(result)).toEqual(["db.schema_mismatch"]);
    expect(result.ok || result.problems[0]).toMatchObject({
      differences: ["missing in database: index notes.notes_title_idx: CREATE INDEX notes_title_idx ON notes.notes USING btree (title)"],
    });
    expect(formatLedger(await readLedger(handle))).toEqual(["softure/1/applied"]);
    expect(calls).toEqual([]);
  });

  it("applies a new dependency before adopting the module in the same run", async () => {
    const handle = await open();

    const result = await migrate(handle, { modules: createNotesWithExtras(), app: createApp(APP_NOTES, { baseline: { notes: 2 } }) });

    expect(result.ok).toBe(true);
    expect(formatLedger(await readLedger(handle))).toEqual(["softure/1/applied", "extras/1/applied", "notes/1/adopted", "notes/2/adopted"]);
  });

  it.each([
    ["a module that is not enabled", { tags: 1 }, "db.adopt_unknown_module"],
    ["zero files", { notes: 0 }, "db.adopt_through_out_of_range"],
    ["more files than the module has", { notes: 3 }, "db.adopt_through_out_of_range"],
    ["a fraction", { notes: 1.5 }, "db.adopt_through_out_of_range"],
  ])("refuses a baseline naming %s before anything runs", async (_label, baseline, code) => {
    const handle = await open();
    const calls: string[] = [];
    const app = createApp(APP_NOTES, { baseline, before: () => { calls.push("before"); return Promise.resolve(); } });

    const result = await migrate(handle, { modules: [createNotesModule()], app });

    expect(getCodes(result)).toEqual([code]);
    expect(calls).toEqual([]);
    expect(await queryRows(handle, "SELECT to_regclass('softure.migrations') IS NULL AS missing")).toEqual([{ missing: true }]);
  });

  it("refuses a baseline for a module without a schema", async () => {
    const handle = await open();
    const plain = createFixtureModule({ id: "plain", dbSchema: null, migrationsDir: null });

    const result = await migrate(handle, { modules: [plain], app: { baseline: { plain: 1 } } });

    expect(getCodes(result)).toEqual(["db.adopt_no_schema"]);
  });

  it("plans the files a baseline may adopt, and none once the module is in the ledger", async () => {
    const handle = await open();
    const app = createApp(APP_NOTES, { baseline: { notes: 2 } });
    const modules = [createNotesModule()];

    const before = await planMigrations(handle, { modules, app });
    const migrated = await migrate(handle, { modules, app });
    const after = await planMigrations(handle, { modules, app });

    expect(before.ok && before.value.baseline.map((step) => `${step.module}/${step.version}`)).toEqual(["notes/1", "notes/2"]);
    expect(before.ok && before.value.pending.length).toBe(3);
    expect(migrated.ok).toBe(true);
    expect(after.ok && after.value).toEqual({ pending: [], baseline: [] });
  });
});
