import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { adoptModule, describeProblem, migrate, type DatabaseHandle, type MigrationResult } from "@softure-ai/db";
import { copyFixtureMigrations, createFixtureModule, createNotesModule, createTagsModule } from "./fixtures/modules.js";
import { createTestDrivers } from "./support/drivers.js";
import { execSql, hasSchema, queryRows, readLedger } from "./support/query.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

// What an adopting app did before: its own `notes` table in `public`, built with its own DDL
// (an extra column it later dropped), filled with data, then moved by its own migration.
const APP_NOTES = `
  CREATE TABLE notes (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    legacy_flag boolean,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX notes_title_idx ON notes (title);
  INSERT INTO notes (title) VALUES ('first'), ('second');
  ALTER TABLE notes DROP COLUMN legacy_flag;
  CREATE SCHEMA notes;
  ALTER TABLE public.notes SET SCHEMA notes;
`;

const APP_TAGS = `
  CREATE TABLE tags (
    id serial PRIMARY KEY,
    note_id integer NOT NULL REFERENCES notes.notes (id) ON DELETE CASCADE,
    label text NOT NULL,
    CONSTRAINT tags_note_label_unique UNIQUE (note_id, label)
  );
  CREATE SCHEMA tags;
  ALTER TABLE public.tags SET SCHEMA tags;
`;

function getDifferences<T>(result: MigrationResult<T>): readonly string[] {
  if (result.ok) throw new Error("expected a failure");
  const [problem] = result.problems;
  if (problem?.code !== "db.schema_mismatch") throw new Error(`expected a schema mismatch, got ${problem?.code}`);
  return problem.differences;
}

function getCodes<T>(result: MigrationResult<T>): string[] {
  if (result.ok) throw new Error("expected a failure");
  return result.problems.map((problem) => problem.code);
}

describe.each(createTestDrivers())("adoptModule on $name", (driver) => {
  afterEach(() => driver.cleanup());

  async function openAppDatabase(sql: string = APP_NOTES): Promise<DatabaseHandle> {
    const handle = await driver.open();
    await execSql(handle, sql);
    return handle;
  }

  it("checks without writing on a dry run, then records the module's migrations as adopted", async () => {
    const handle = await openAppDatabase();
    const modules = [createNotesModule()];

    const dryRun = await adoptModule(handle, { modules, module: "notes", version: "0.1.0", dryRun: true });

    expect(dryRun.ok && dryRun.value).toMatchObject({
      dryRun: true,
      ledger: [{ module: "softure", version: 1 }],
      adopted: [{ version: 1, name: "create_notes" }, { version: 2, name: "add_notes_title_index" }],
    });
    expect(await hasSchema(handle, "softure")).toBe(false);

    const adopted = await adoptModule(handle, { modules, module: "notes", version: "0.1.0" });

    expect(adopted.ok).toBe(true);
    expect(await readLedger(handle)).toEqual([
      { module: "softure", version: 1, name: "ledger", method: "applied" },
      { module: "notes", version: 1, name: "create_notes", method: "adopted" },
      { module: "notes", version: 2, name: "add_notes_title_index", method: "adopted" },
    ]);
  });

  it("keeps the data and lets later migrations run normally", async () => {
    const handle = await openAppDatabase();
    const copy = copyFixtureMigrations("notes");
    cleanups.push(copy.cleanup);
    await adoptModule(handle, { modules: [createNotesModule(copy.dir)], module: "notes", version: "0.1.0" });
    writeFileSync(join(copy.path, "0003_add_notes_body.sql"), "-- Rollback: ALTER TABLE notes.notes DROP COLUMN body;\nALTER TABLE notes ADD COLUMN body text;\n");

    const result = await migrate(handle, { modules: [createNotesModule(copy.dir)] });

    expect(result.ok && result.value.applied.map((step) => step.name)).toEqual(["add_notes_body"]);
    expect(await queryRows(handle, "SELECT title FROM notes.notes ORDER BY id")).toEqual([{ title: "first" }, { title: "second" }]);
  });

  it.each([
    ["a missing column", "ALTER TABLE notes.notes DROP COLUMN created_at", "missing in database: column notes.notes.created_at timestamp with time zone not null default now()"],
    ["a different type", "ALTER TABLE notes.notes ALTER COLUMN title TYPE varchar(200)", "unexpected in database: column notes.notes.title character varying(200) not null"],
    ["an extra index", "CREATE INDEX notes_created_idx ON notes.notes (created_at)", "unexpected in database: index notes.notes_created_idx: CREATE INDEX notes_created_idx ON notes.notes USING btree (created_at)"],
    ["a renamed constraint", "ALTER TABLE notes.notes RENAME CONSTRAINT notes_pkey TO notes_primary", "unexpected in database: constraint notes.notes.notes_primary: PRIMARY KEY (id)"],
    ["a nullable column", "ALTER TABLE notes.notes ALTER COLUMN title DROP NOT NULL", "unexpected in database: column notes.notes.title text"],
  ])("refuses %s and writes nothing", async (_label, change, difference) => {
    const handle = await openAppDatabase();
    await execSql(handle, change);

    const result = await adoptModule(handle, { modules: [createNotesModule()], module: "notes", version: "0.1.0" });

    expect(getDifferences(result)).toContain(difference);
    expect(await hasSchema(handle, "softure")).toBe(false);
    expect(result.ok || result.problems.map(describeProblem).join("\n")).toContain('schema "notes" differs');
  });

  it("refuses a table whose serial sequence stayed behind in public", async () => {
    const handle = await openAppDatabase(`
      ${APP_NOTES}
      CREATE SEQUENCE tags_id_seq;
      CREATE TABLE tags (
        id integer NOT NULL DEFAULT nextval('tags_id_seq') PRIMARY KEY,
        note_id integer NOT NULL REFERENCES notes.notes (id) ON DELETE CASCADE,
        label text NOT NULL,
        CONSTRAINT tags_note_label_unique UNIQUE (note_id, label)
      );
      CREATE SCHEMA tags;
      ALTER TABLE public.tags SET SCHEMA tags;
    `);
    await adoptModule(handle, { modules: [createNotesModule()], module: "notes", version: "0.1.0" });

    const result = await adoptModule(handle, { modules: [createNotesModule(), createTagsModule()], module: "tags", version: "0.1.0" });

    expect(getDifferences(result)).toEqual([
      "missing in database: column tags.tags.id integer not null default nextval('tags.tags_id_seq'::regclass)",
      "missing in database: sequence tags.tags_id_seq",
      "missing in database: sequence tags.tags_id_seq: integer start 1 increment 1 min 1 max 2147483647 cache 1",
      "unexpected in database: column tags.tags.id integer not null default nextval('public.tags_id_seq'::regclass)",
    ]);
  });

  it.each([
    ["a composite type", "CREATE TYPE pair AS (a int, b int);", "", "missing in database: composite type extras.pair"],
    ["a column collation", "CREATE TABLE items (title text COLLATE \"C\");", "CREATE TABLE extras.items (title text);", 'missing in database: column extras.items.title text collate "C"'],
    ["sequence parameters", "CREATE SEQUENCE counter START 1000 INCREMENT 5;", "CREATE SEQUENCE extras.counter;", "missing in database: sequence extras.counter: bigint start 1000 increment 5 min 1 max 9223372036854775807 cache 1"],
    ["an unlogged table", "CREATE UNLOGGED TABLE scratch (id int);", "CREATE TABLE extras.scratch (id int);", "missing in database: unlogged table extras.scratch"],
  ])("refuses a schema that lacks %s", async (_label, moduleSql, appSql, difference) => {
    const handle = await openAppDatabase(`CREATE SCHEMA extras; ${appSql}`);
    const copy = copyFixtureMigrations("notes");
    cleanups.push(copy.cleanup);
    rmSync(join(copy.path, "0001_create_notes.sql"));
    rmSync(join(copy.path, "0002_add_notes_title_index.sql"));
    writeFileSync(join(copy.path, "0001_create_extras.sql"), `-- Rollback: DROP SCHEMA extras CASCADE;\n${moduleSql}\n`);
    const extras = createFixtureModule({ id: "extras", migrationsDir: copy.dir });

    const result = await adoptModule(handle, { modules: [extras], module: "extras", version: "0.1.0" });

    expect(getDifferences(result)).toContain(difference);
  });

  it("adopts a dependent module once its dependency is in the ledger", async () => {
    const handle = await openAppDatabase(`${APP_NOTES}${APP_TAGS}`);
    const modules = [createNotesModule(), createTagsModule()];

    const early = await adoptModule(handle, { modules, module: "tags", version: "0.1.0" });
    await adoptModule(handle, { modules, module: "notes", version: "0.1.0" });
    const later = await adoptModule(handle, { modules, module: "tags", version: "0.1.0" });

    expect(getCodes(early)).toEqual(["db.adopt_dependency_pending"]);
    expect(later.ok).toBe(true);
    expect((await readLedger(handle)).map((row) => `${row.module}/${row.version}/${row.method}`)).toEqual([
      "softure/1/applied",
      "notes/1/adopted",
      "notes/2/adopted",
      "tags/1/adopted",
    ]);
    expect((await migrate(handle, { modules })).ok && "nothing to apply").toBe("nothing to apply");
  });

  it("refuses a wrong version, an unlisted module and a module already in the ledger", async () => {
    const handle = await driver.open();
    const modules = [createNotesModule()];
    await migrate(handle, { modules });

    expect(getCodes(await adoptModule(handle, { modules, module: "notes", version: "0.2.0" }))).toEqual(["db.adopt_version_mismatch"]);
    expect(getCodes(await adoptModule(handle, { modules, module: "tags", version: "0.1.0" }))).toEqual(["db.adopt_unknown_module"]);
    expect(getCodes(await adoptModule(handle, { modules, module: "notes", version: "0.1.0" }))).toEqual(["db.adopt_already_applied"]);
  });
});
