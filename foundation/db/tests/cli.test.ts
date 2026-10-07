import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { defineSoftureConfig } from "@softure-ai/core";
import { createDatabase } from "@softure-ai/db";
import { runMigrateCli, runSoftureCommand, type CliOutput } from "@softure-ai/db/cli";
import type { AppMigrations } from "@softure-ai/db";
import { createLinkedModule, createNotesModule, createNotesWithNewDependency, createTagsModule } from "./fixtures/modules.js";
import { execSql, queryRows, readLedger } from "./support/query.js";

const cleanups: (() => void)[] = [];
const APP_DIR = fileURLToPath(new URL("./fixtures/app/", import.meta.url));

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "softure-db-cli-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function createOutput(): CliOutput & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, log: (line) => lines.push(line), error: (line) => errors.push(line) };
}

function createConfig(url: string | null) {
  return { database: url === null ? null : { url }, modules: [createTagsModule(), createNotesModule()] };
}

async function run(argv: string[], url: string | null = `pglite://${createTempDir()}`) {
  const output = createOutput();
  const code = await runMigrateCli({ config: createConfig(url), argv, output });
  return { code, ...output };
}

describe("softure migrate", () => {
  it("applies every migration, then has nothing to apply", async () => {
    const url = `pglite://${createTempDir()}`;

    const first = await run([], url);
    const second = await run([], url);

    expect(first).toMatchObject({ code: 0, errors: [] });
    expect(first.lines).toEqual([
      "applied softure 0001_ledger.sql",
      "applied notes 0001_create_notes.sql",
      "applied notes 0002_add_notes_title_index.sql",
      "applied tags 0001_create_tags.sql",
      "4 migration(s) applied",
    ]);
    expect(second.lines).toEqual(["nothing to apply"]);
  });

  it("plans without writing", async () => {
    const url = `pglite://${createTempDir()}`;

    const plan = await run(["--plan"], url);
    const handle = await createDatabase(url);
    const ledger = await queryRows(handle, "SELECT to_regclass('softure.migrations') AS ledger");
    await handle.close();

    expect(plan.code).toBe(0);
    expect(plan.lines.at(-1)).toBe("4 migration(s) to apply");
    expect(plan.lines[0]).toBe("pending softure 0001_ledger.sql");
    expect(ledger).toEqual([{ ledger: null }]);
  });

  it("adopts with --adopt, as a plan first", async () => {
    const url = `pglite://${createTempDir()}`;
    const handle = await createDatabase(url);
    await execSql(
      handle,
      `CREATE SCHEMA notes;
       CREATE TABLE notes.notes (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
       CREATE INDEX notes_title_idx ON notes.notes (title);`,
    );
    await handle.close();
    const notesOnly = { database: { url }, modules: [createNotesModule()] };
    const output = createOutput();

    const planned = await runMigrateCli({ config: notesOnly, argv: ["--adopt", "notes@0.1.0", "--plan"], output });
    const adopted = await runMigrateCli({ config: notesOnly, argv: ["--adopt=notes@0.1.0"], output });

    expect([planned, adopted]).toEqual([0, 0]);
    expect(output.lines).toContain("would adopt notes 0002_add_notes_title_index.sql");
    expect(output.lines).toContain("notes@0.1.0: the schema matches its migrations (plan only, nothing written)");
    expect(output.lines.at(-1)).toBe("notes@0.1.0: the schema matches its migrations; adopted");
    const check = await createDatabase(url);
    expect((await readLedger(check)).map((row) => row.method)).toEqual(["applied", "adopted", "adopted"]);
    await check.close();
  });

  it("runs the app's migrations around the module files", async () => {
    const url = `pglite://${createTempDir()}`;
    const calls: string[] = [];
    const app: AppMigrations = {
      before: async (handle) => {
        calls.push("before");
        await execSql(handle, "CREATE TABLE IF NOT EXISTS public.app_users (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY)");
      },
      after: () => {
        calls.push("after");
        return Promise.resolve();
      },
    };
    const output = createOutput();

    const code = await runMigrateCli({ config: { database: { url }, modules: [createLinkedModule()] }, argv: [], output, app });

    expect({ code, errors: output.errors, calls }).toEqual({ code: 0, errors: [], calls: ["before", "after"] });
    expect(output.lines).toEqual([
      "applied softure 0001_ledger.sql",
      "applied app migrations (before)",
      "applied linked 0001_create_links.sql",
      "applied app migrations (after)",
      "2 migration(s) applied",
    ]);
  });

  it("plans without running the app's migrations", async () => {
    const calls: string[] = [];
    const app: AppMigrations = {
      before: () => {
        calls.push("before");
        return Promise.resolve();
      },
    };
    const output = createOutput();

    const code = await runMigrateCli({ config: createConfig(`pglite://${createTempDir()}`), argv: ["--plan"], output, app });

    expect(code).toBe(0);
    expect(calls).toEqual([]);
    expect(output.lines[0]).toBe("app migrations: not planned; the app runs them itself on migrate");
  });

  it("prints a failing app migration and exits 1", async () => {
    const output = createOutput();
    const app: AppMigrations = { before: () => Promise.reject(new Error("drizzle folder not found")) };

    const code = await runMigrateCli({ config: createConfig(`pglite://${createTempDir()}`), argv: [], output, app });

    expect(code).toBe(1);
    expect(output.errors).toEqual(["app: the before migrations failed: drizzle folder not found; no module migration ran"]);
  });

  it("runs the app's before migrations ahead of --adopt, so moving a table and adopting it is one command", async () => {
    const url = `pglite://${createTempDir()}`;
    const app: AppMigrations = {
      // The app's own migration that moved its table into the module's schema.
      before: (handle) =>
        execSql(
          handle,
          `CREATE SCHEMA IF NOT EXISTS notes;
           CREATE TABLE IF NOT EXISTS notes.notes (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
           CREATE INDEX IF NOT EXISTS notes_title_idx ON notes.notes (title);`,
        ),
    };
    const config = { database: { url }, modules: [createNotesModule()] };
    const output = createOutput();

    const adopted = await runMigrateCli({ config, argv: ["--adopt", "notes@0.1.0"], output, app });
    const migrated = await runMigrateCli({ config, argv: [], output, app });

    expect({ adopted, migrated, errors: output.errors }).toEqual({ adopted: 0, migrated: 0, errors: [] });
    expect(output.lines[0]).toBe("applied app migrations (before)");
    expect(output.lines).toContain("notes@0.1.0: the schema matches its migrations; adopted");
    expect(output.lines.slice(-2)).toEqual(["applied app migrations (before)", "nothing to apply"]);
  });

  it("adopts a baseline on a fresh database within a plain migrate, and marks it in the plan", async () => {
    const url = `pglite://${createTempDir()}`;
    const app: AppMigrations = {
      before: (handle) =>
        execSql(
          handle,
          `CREATE SCHEMA IF NOT EXISTS notes;
           CREATE TABLE IF NOT EXISTS notes.notes (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`,
        ),
      baseline: { notes: 1 },
    };
    const config = { database: { url }, modules: [createNotesModule()] };
    const planned = createOutput();
    const migrated = createOutput();

    const planCode = await runMigrateCli({ config, argv: ["--plan"], output: planned, app });
    const migrateCode = await runMigrateCli({ config, argv: [], output: migrated, app });

    expect([planCode, migrateCode]).toEqual([0, 0]);
    expect(planned.lines).toContain("pending notes 0001_create_notes.sql (adopted if its schema already holds objects)");
    expect(planned.lines).toContain("pending notes 0002_add_notes_title_index.sql");
    expect(migrated.lines).toEqual([
      "applied softure 0001_ledger.sql",
      "applied app migrations (before)",
      "adopted notes 0001_create_notes.sql",
      "applied notes 0002_add_notes_title_index.sql",
      "2 migration(s) applied, 1 adopted",
    ]);
  });

  it("adopts the files up to --through and applies a new dependency first with --adopt", async () => {
    const url = `pglite://${createTempDir()}`;
    const handle = await createDatabase(url);
    await execSql(
      handle,
      `CREATE SCHEMA notes;
       CREATE TABLE notes.notes (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`,
    );
    await handle.close();
    const fixture = createNotesWithNewDependency();
    cleanups.push(fixture.cleanup);
    const output = createOutput();

    const code = await runMigrateCli({ config: { database: { url }, modules: fixture.modules }, argv: ["--adopt", "notes@0.1.0", "--through", "1"], output });

    expect({ code, errors: output.errors }).toEqual({ code: 0, errors: [] });
    expect(output.lines).toEqual([
      "did apply softure 0001_ledger.sql",
      "did apply extras 0001_create_limits.sql",
      "did adopt notes 0001_create_notes.sql",
      "notes@0.1.0: the schema matches its migrations through 0001; adopted",
    ]);
  });

  it("prints each problem and exits 1", async () => {
    const result = await run(["--adopt", "notes@0.9.0"]);

    expect(result.code).toBe(1);
    expect(result.errors).toEqual(["notes: --adopt asks for 0.9.0 but 0.1.0 is enabled"]);
  });

  it.each([
    [["--adopt", "notes"], '--adopt expects <module>@<x.y.z>, e.g. auth@0.1.0, got "notes"'],
    [["--force"], "Unknown option '--force'"],
    [["extra"], "Unexpected argument 'extra'"],
    [["--export-migrations", "out", "--plan"], "--export-migrations cannot be combined with --plan"],
    [["--through", "1"], "--through needs --adopt"],
    [["--adopt", "notes@0.1.0", "--through", "x"], '--through expects a positive whole number, got "x"'],
    [["--adopt", "notes@0.1.0", "--through", "0"], '--through expects a positive whole number, got "0"'],
  ])("rejects %j with the usage and exit code 2", async (argv, message) => {
    const result = await run(argv);

    expect(result.code).toBe(2);
    expect(result.errors[0]).toContain(message);
    expect(result.errors[1]).toContain("Usage: softure migrate");
  });

  it("prints the usage for --help", async () => {
    const result = await run(["--help"]);

    expect(result.code).toBe(0);
    expect(result.lines[0]).toContain("Usage: softure migrate");
  });

  it("needs a database in the config", async () => {
    const result = await run([], null);

    expect(result).toMatchObject({ code: 1, errors: ["softure migrate: the config has no database; set database.url in softure.config"] });
  });

  it("refuses an empty database URL when it has to connect", async () => {
    const result = await run([], "");

    expect(result).toMatchObject({
      code: 1,
      errors: ["softure migrate: createDatabase: the database URL is empty; set database.url in softure.config (usually from DATABASE_URL)"],
    });
  });

  it("exports module files with an app config whose database URL is empty (a build without DATABASE_URL)", async () => {
    const dir = createTempDir();
    const config = defineSoftureConfig({
      database: { url: "" },
      locale: "en",
      timezone: "Europe/Warsaw",
      appOrigin: "http://localhost:3000",
      modules: [createTagsModule(), createNotesModule()],
    });
    const output = createOutput();

    const code = await runMigrateCli({ config, argv: ["--export-migrations", dir], output });

    expect({ code, errors: output.errors }).toEqual({ code: 0, errors: [] });
    expect(readdirSync(dir).sort()).toEqual(["notes", "tags"]);
  });

  it("reports an unsupported database URL without printing it", async () => {
    const result = await run([], "mysql://root:hunter2@db/app");

    expect(result.code).toBe(1);
    expect(result.errors.join("\n")).toContain('unsupported database URL scheme "mysql:"');
    expect(result.errors.join("\n")).not.toContain("hunter2");
  });

  it("refuses to export into a folder that holds other files", async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, "notes"));
    writeFileSync(join(dir, "notes", "handler.ts"), "export {};\n");
    writeFileSync(join(dir, "notes", "0009_stale.sql"), "-- old export\n");

    const result = await run(["--export-migrations", dir], null);

    expect(result.code).toBe(1);
    expect(result.errors).toEqual([`notes: ${join(dir, "notes")} holds other files (handler.ts); export into an empty folder`]);
    expect(readdirSync(join(dir, "notes")).sort()).toEqual(["0009_stale.sql", "handler.ts"]);
  });

  it("replaces the SQL files of an earlier export", async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, "notes"));
    writeFileSync(join(dir, "notes", "0009_stale.sql"), "-- old export\n");

    const result = await run(["--export-migrations", dir], null);

    expect(result.code).toBe(0);
    expect(readdirSync(join(dir, "notes")).sort()).toEqual(["0001_create_notes.sql", "0002_add_notes_title_index.sql"]);
  });

  it("exports module files without a database and migrates from the export", async () => {
    const dir = createTempDir();

    const exported = await run(["--export-migrations", join(dir, "migrations")], null);
    const migrated = await run(["--migrations-dir", join(dir, "migrations")]);

    expect(exported.code).toBe(0);
    expect(exported.lines).toEqual([
      "exported notes 0001_create_notes.sql",
      "exported notes 0002_add_notes_title_index.sql",
      "exported tags 0001_create_tags.sql",
    ]);
    expect(readdirSync(join(dir, "migrations")).sort()).toEqual(["notes", "tags"]);
    expect(migrated.code).toBe(0);
  });
});

describe("the softure bin", () => {
  async function runBin(argv: string[], cwd = APP_DIR) {
    const output = createOutput();
    const code = await runSoftureCommand({ argv, cwd, output });
    return { code, ...output };
  }

  it("finds softure.config.mjs in the working directory", async () => {
    const result = await runBin(["migrate", "--plan"]);

    expect(result).toMatchObject({ code: 0, errors: [] });
    expect(result.lines.at(-1)).toBe("4 migration(s) to apply");
  });

  it("loads a config exported as config through --config", async () => {
    const result = await runBin(["migrate", "--config", "named.config.mjs", "--plan"]);

    expect(result.code).toBe(0);
    expect(result.lines.at(-1)).toBe("3 migration(s) to apply");
  });

  it("refuses a file that is not a config, a missing file and a missing config", async () => {
    const notConfig = await runBin(["migrate", "--config=no-modules.config.mjs"]);
    const missing = await runBin(["migrate", "--config", "nope.mjs"]);
    const none = await runBin(["migrate"], createTempDir());

    expect(notConfig).toMatchObject({ code: 1, errors: [expect.stringContaining("must export (default or as \"config\")")] });
    expect(missing).toMatchObject({ code: 1, errors: [expect.stringContaining("does not exist")] });
    expect(none).toMatchObject({ code: 1, errors: [expect.stringContaining("no config found")] });
  });

  it("prints the help without needing a config", async () => {
    const result = await runBin(["migrate", "--help"], createTempDir());

    expect(result.code).toBe(0);
    expect(result.lines[0]).toContain("Usage: softure migrate");
  });

  it.each([[["migrate", "--config"]], [["migrate", "--config", "--plan"]]])("rejects %j without a config path", async (argv) => {
    const result = await runBin(argv);

    expect(result.code).toBe(2);
    expect(result.errors[0]).toBe("softure migrate: --config needs a file path");
  });

  it("rejects an unknown command", async () => {
    const result = await runBin(["seed"]);

    expect(result.code).toBe(2);
    expect(result.errors[0]).toBe('softure: unknown command "seed"');
    expect(existsSync(join(APP_DIR, "softure.config.mjs"))).toBe(true);
  });
});
