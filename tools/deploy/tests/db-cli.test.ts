// The database commands on a real Postgres: a fresh database per test on the server in
// SOFTURE_TEST_POSTGRES_URL (the CI service; locally the cases skip without it, as in @softure-ai/db).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { defineModule, type ModuleManifest } from "@softure-ai/core";
import { createDatabase, migrate } from "@softure-ai/db";
import pg from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

const ADMIN_URL = process.env.SOFTURE_TEST_POSTGRES_URL || undefined;

const NOTES_0001 = "-- Rollback: DROP TABLE notes;\nCREATE TABLE notes (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, body text NOT NULL);\n";
const NOTES_0002 = "-- Rollback: DROP INDEX notes_body;\nCREATE INDEX notes_body ON notes (body);\n";

let dir: string;
let out: string[];
let err: string[];
const cleanups: (() => Promise<void>)[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-db-"));
  out = [];
  err = [];
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  rmSync(dir, { recursive: true, force: true });
});

function makeIo(env: Record<string, string | undefined>, stdin?: string | Buffer): CliIo {
  return {
    cwd: dir,
    env: { PATH: process.env.PATH, ...env },
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    ...(stdin === undefined ? {} : { input: Readable.from([typeof stdin === "string" ? Buffer.from(stdin) : stdin]) }),
  };
}

/** What `psql -At -c "$(softure-deploy <command> --print-query …)"` prints: the statement the CLI printed, run as is. */
async function runPrintedQuery(url: string, command: string[]): Promise<string> {
  const printed: string[] = [];
  const io: CliIo = { cwd: dir, env: {}, stdout: (text) => printed.push(text), stderr: (text) => err.push(text) };
  expect(await runCli([...command, "--print-query"], io)).toBe(0);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query<{ snapshot: string }>(printed.join(""));
    return `${result.rows[0]?.snapshot ?? ""}\n`;
  } finally {
    await client.end();
  }
}

/** drizzle's ledger with `rows` entries, as drizzle's migrator leaves it. */
const DRIZZLE_LEDGER_SQL = "CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);";

function writeAppJournal(name: string, entries: number): void {
  const journal = { version: "7", dialect: "postgresql", entries: Array.from({ length: entries }, (_, idx) => ({ idx, tag: `000${idx}_x` })) };
  writeFileSync(join(dir, name), JSON.stringify(journal));
}

async function runAdmin(text: string): Promise<void> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
}

/** A new empty database, dropped after the test. */
async function createTestDatabase(): Promise<string> {
  // Generated from hex only, so it is safe to splice into the statement.
  const name = `softure_deploy_${randomBytes(6).toString("hex")}`;
  await runAdmin(`CREATE DATABASE ${name}`);
  cleanups.push(() => runAdmin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
  const url = new URL(ADMIN_URL ?? "");
  url.pathname = `/${name}`;
  return url.href;
}

async function runSql(url: string, text: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
}

/** `<dir>/<name>/notes/…`: the folder `softure migrate --export-migrations` writes in the image. */
function writeExport(name: string, files: Record<string, string>): string {
  const moduleDir = join(dir, name, "notes");
  mkdirSync(moduleDir, { recursive: true });
  for (const [fileName, sql] of Object.entries(files)) writeFileSync(join(moduleDir, fileName), sql);
  return join(dir, name);
}

/** Migrates the database the way the running app did: `notes` with the files of `exportDir`. */
async function migrateNotes(url: string, exportDir: string): Promise<void> {
  const manifest: ModuleManifest = {
    id: "notes",
    version: "0.1.0",
    dependsOn: {},
    dbSchema: "notes",
    tables: [],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  };
  const notes = defineModule({
    manifest,
    messages: { en: { title: "Notes" }, pl: { title: "Notes" } },
    migrations: { dir: pathToFileURL(`${join(exportDir, "notes")}/`) },
  })();
  const handle = await createDatabase(url);
  try {
    const result = await migrate(handle, { modules: [notes] });
    expect(result.ok).toBe(true);
  } finally {
    await handle.close();
  }
}

describe.runIf(ADMIN_URL !== undefined)("softure-deploy database commands on Postgres", () => {
  describe("backup", () => {
    it("writes a restorable custom-format dump with mode 0600 and prints its path, never the URL", async () => {
      const url = await createTestDatabase();
      await runSql(url, "CREATE TABLE users (id int); INSERT INTO users VALUES (1), (2);");
      expect(await runCli(["backup", "--dir=backups"], makeIo({ DATABASE_URL: url }))).toBe(0);
      const [file, ...others] = readdirSync(join(dir, "backups"));
      expect(others).toEqual([]);
      expect(file).toMatch(/^db-\d{8}T\d{6}Z\.dump$/);
      const path = join(dir, "backups", file ?? "");
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(execFileSync("pg_restore", ["--list", path], { encoding: "utf8" })).toMatch(/TABLE DATA public users/);
      expect(out.join("")).toMatch(new RegExp(`^backup: wrote ${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(\\d+ bytes\\)\\n$`));
      expect(out.join("") + err.join("")).not.toContain(url);
    });

    it("keeps the definition but not the rows of an excluded table", async () => {
      const url = await createTestDatabase();
      await runSql(url, "CREATE TABLE users (id int); CREATE TABLE auth_attempts (ip text); INSERT INTO auth_attempts VALUES ('203.0.113.7');");
      expect(await runCli(["backup", "--dir=backups", "--exclude-table-data=auth_attempts"], makeIo({ DATABASE_URL: url }))).toBe(0);
      const [file] = readdirSync(join(dir, "backups"));
      const listing = execFileSync("pg_restore", ["--list", join(dir, "backups", file ?? "")], { encoding: "utf8" });
      expect(listing).toMatch(/TABLE public auth_attempts/);
      expect(listing).not.toMatch(/TABLE DATA public auth_attempts/);
      expect(listing).toMatch(/TABLE DATA public users/);
    });

    it("keeps the newest --keep dumps of the prefix and never touches other files", async () => {
      const url = await createTestDatabase();
      const backups = join(dir, "backups");
      mkdirSync(backups);
      for (const name of ["app-20200101T000000Z.dump", "app-20200102T000000Z.dump", "db-20200101T000000Z.dump", "notes.txt"]) {
        writeFileSync(join(backups, name), "old");
      }
      expect(await runCli(["backup", "--dir=backups", "--prefix=app", "--keep=2"], makeIo({ DATABASE_URL: url }))).toBe(0);
      const left = readdirSync(backups).sort();
      expect(left.filter((name) => name.startsWith("app-"))).toHaveLength(2);
      expect(left).toContain("app-20200102T000000Z.dump");
      expect(left).not.toContain("app-20200101T000000Z.dump");
      expect(left).toContain("db-20200101T000000Z.dump");
      expect(left).toContain("notes.txt");
      expect(out.join("")).toContain("; removed 1 older: app-20200101T000000Z.dump");
    });

    it("leaves no file and deletes no older dump when pg_dump fails", async () => {
      const url = new URL(await createTestDatabase());
      url.pathname = "/softure_deploy_missing_database";
      const backups = join(dir, "backups");
      mkdirSync(backups);
      writeFileSync(join(backups, "db-20200101T000000Z.dump"), "old");
      expect(await runCli(["backup", "--dir=backups", "--keep=1"], makeIo({ DATABASE_URL: url.href }))).toBe(1);
      expect(readdirSync(backups)).toEqual(["db-20200101T000000Z.dump"]);
      expect(err.join("")).toMatch(/^backup: no backup written; pg_dump failed \(exit code 1\): .*softure_deploy_missing_database.*\.\n$/);
      expect(err.join("")).not.toContain(url.password === "" ? "\u0000" : `:${url.password}@`);
    });
  });

  describe("schema-guard", () => {
    it("passes an image with the applied files and new ones, listing the pending ones", async () => {
      const url = await createTestDatabase();
      await migrateNotes(url, writeExport("running", { "0001_create_notes.sql": NOTES_0001 }));
      writeExport("image", { "0001_create_notes.sql": NOTES_0001, "0002_index_body.sql": NOTES_0002 });
      expect(await runCli(["schema-guard", "--migrations-dir=image"], makeIo({ DATABASE_URL: url }))).toBe(0);
      expect(out.join("")).toBe("schema-guard: ok, 1 migration(s) to apply\n  pending notes 0002_index_body.sql\n");
      expect(err).toEqual([]);
    });

    it("refuses an image whose applied file was edited and one that lacks an applied file", async () => {
      const url = await createTestDatabase();
      await migrateNotes(url, writeExport("running", { "0001_create_notes.sql": NOTES_0001, "0002_index_body.sql": NOTES_0002 }));
      writeExport("edited", { "0001_create_notes.sql": `${NOTES_0001}-- edited\n`, "0002_index_body.sql": NOTES_0002 });
      writeExport("older", { "0001_create_notes.sql": NOTES_0001 });
      expect(await runCli(["schema-guard", "--migrations-dir=edited"], makeIo({ DATABASE_URL: url }))).toBe(1);
      expect(await runCli(["schema-guard", "--migrations-dir=older"], makeIo({ DATABASE_URL: url }))).toBe(1);
      expect(err.join("")).toBe(
        [
          "schema-guard: the database cannot take this image's migrations:",
          "  notes: applied migration 0001_create_notes.sql was edited (checksum differs); add a new migration instead",
          "schema-guard: the database cannot take this image's migrations:",
          "  notes: applied migration 0002_index_body.sql is missing from the module",
          "",
        ].join("\n"),
      );
    });

    it("passes a fresh database: every file is pending, the ledger first", async () => {
      const url = await createTestDatabase();
      writeExport("image", { "0001_create_notes.sql": NOTES_0001 });
      expect(await runCli(["schema-guard", "--migrations-dir=image"], makeIo({ DATABASE_URL: url }))).toBe(0);
      expect(out.join("")).toBe("schema-guard: ok, 2 migration(s) to apply\n  pending softure 0001_ledger.sql\n  pending notes 0001_create_notes.sql\n");
    });

    it("refuses an image whose app journal lists fewer migrations than the app ledger ran, and passes one that lists as many", async () => {
      const url = await createTestDatabase();
      await runSql(url, `${DRIZZLE_LEDGER_SQL} INSERT INTO drizzle.__drizzle_migrations (hash) VALUES ('a'), ('b'), ('c');`);
      writeExport("image", { "0001_create_notes.sql": NOTES_0001 });
      writeAppJournal("older.json", 2);
      writeAppJournal("same.json", 3);
      const io = makeIo({ DATABASE_URL: url });
      expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=older.json"], io)).toBe(1);
      expect(err.join("")).toBe(
        "schema-guard: the database cannot take this image's migrations:\n" +
          "  drizzle.__drizzle_migrations: the image knows 2 migration(s), the database ran 3; this is an older image than the schema\n",
      );
      expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=same.json"], io)).toBe(0);
      expect(out.join("")).toBe(
        "schema-guard: ok, 2 migration(s) to apply\n  pending softure 0001_ledger.sql\n  pending notes 0001_create_notes.sql\n" +
          "  drizzle.__drizzle_migrations: the image knows 3, the database ran 3\n",
      );
    });

    it("counts an app ledger table the database lacks as no migrations run, and reads one --app-ledger names", async () => {
      const url = await createTestDatabase();
      writeExport("image", { "0001_create_notes.sql": NOTES_0001 });
      writeAppJournal("journal.json", 0);
      const io = makeIo({ DATABASE_URL: url });
      expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=journal.json"], io)).toBe(0);
      expect(out.join("")).toContain("  drizzle.__drizzle_migrations: the image knows 0, the database ran 0\n");
      await runSql(url, "CREATE TABLE app_migrations (id int); INSERT INTO app_migrations VALUES (1);");
      expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=journal.json", "--app-ledger=app_migrations"], io)).toBe(1);
      expect(err.join("")).toContain("app_migrations: the image knows 0 migration(s), the database ran 1");
    });

    it("guards the snapshot psql prints from the --print-query statement exactly as through a connection", async () => {
      const url = await createTestDatabase();
      await migrateNotes(url, writeExport("running", { "0001_create_notes.sql": NOTES_0001 }));
      await runSql(url, `${DRIZZLE_LEDGER_SQL} INSERT INTO drizzle.__drizzle_migrations (hash) VALUES ('a');`);
      writeExport("image", { "0001_create_notes.sql": NOTES_0001, "0002_index_body.sql": NOTES_0002 });
      writeExport("edited", { "0001_create_notes.sql": `${NOTES_0001}-- edited\n` });
      writeAppJournal("journal.json", 1);
      const snapshot = await runPrintedQuery(url, ["schema-guard", "--app-ledger=drizzle.__drizzle_migrations"]);
      expect(JSON.parse(snapshot)).toMatchObject({ app: { ledger: "drizzle.__drizzle_migrations", rows: 1 }, softure: [{ module: "softure" }, { module: "notes", version: 1, method: "applied" }] });
      expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=journal.json", "--stdin"], makeIo({}, snapshot))).toBe(0);
      const viaStdin = out.join("");
      out = [];
      expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=journal.json"], makeIo({ DATABASE_URL: url }))).toBe(0);
      expect(viaStdin).toBe(out.join(""));
      expect(viaStdin).toBe("schema-guard: ok, 1 migration(s) to apply\n  pending notes 0002_index_body.sql\n  drizzle.__drizzle_migrations: the image knows 1, the database ran 1\n");
      expect(await runCli(["schema-guard", "--migrations-dir=edited", "--stdin"], makeIo({}, snapshot))).toBe(1);
      expect(err.join("")).toContain("notes: applied migration 0001_create_notes.sql was edited");
    });

    it("reports a database it cannot reach without printing the URL", async () => {
      const url = new URL(await createTestDatabase());
      url.pathname = "/softure_deploy_missing_database";
      writeExport("image", { "0001_create_notes.sql": NOTES_0001 });
      expect(await runCli(["schema-guard", "--migrations-dir=image"], makeIo({ DATABASE_URL: url.href }))).toBe(1);
      expect(err.join("")).toMatch(/^schema-guard: the database refused the step: .*softure_deploy_missing_database.* does not exist\n$/);
      expect(err.join("")).not.toContain(url.href);
    });
  });

  describe("row-counts", () => {
    it("saves the counts before and passes after a deploy that kept or added rows", async () => {
      const url = await createTestDatabase();
      await runSql(url, "CREATE SCHEMA billing; CREATE TABLE users (id int); CREATE TABLE billing.subscriptions (id int); INSERT INTO users VALUES (1), (2);");
      const io = makeIo({ DATABASE_URL: url });
      expect(await runCli(["row-counts", "--tables=users,billing.subscriptions", "--out=before.json"], io)).toBe(0);
      expect(out.join("")).toBe("row-counts: users 2\nrow-counts: billing.subscriptions 0\n");
      const saved = JSON.parse(readFileSync(join(dir, "before.json"), "utf8")) as { counts: unknown };
      expect(saved.counts).toEqual({ users: 2, "billing.subscriptions": 0 });
      await runSql(url, "INSERT INTO users VALUES (3);");
      out = [];
      expect(await runCli(["row-counts", "--tables=users,billing.subscriptions", "--compare=before.json"], io)).toBe(0);
      expect(out.join("")).toBe("row-counts: users 2 -> 3 (+1)\nrow-counts: billing.subscriptions 0 -> 0 (0)\n");
    });

    it("fails when a table lost rows across the deploy", async () => {
      const url = await createTestDatabase();
      await runSql(url, "CREATE TABLE users (id int); INSERT INTO users VALUES (1), (2);");
      const io = makeIo({ DATABASE_URL: url });
      expect(await runCli(["row-counts", "--tables=users", "--out=before.json"], io)).toBe(0);
      await runSql(url, "DELETE FROM users WHERE id = 2;");
      out = [];
      expect(await runCli(["row-counts", "--tables=users", "--compare=before.json"], io)).toBe(1);
      expect(out.join("")).toBe("row-counts: users 2 -> 1 (-1)\n");
      expect(err.join("")).toBe("row-counts: the deploy lost rows or tables: users (fewer rows than before).\n");
    });

    it("counts the tables listed in deploy.json when --tables is not given", async () => {
      const url = await createTestDatabase();
      await runSql(url, "CREATE SCHEMA billing; CREATE TABLE users (id int); CREATE TABLE billing.subscriptions (id int); INSERT INTO users VALUES (1);");
      writeFileSync(join(dir, "deploy.json"), JSON.stringify({ database: { rowCountTables: ["users", "billing.subscriptions"] } }));
      const io = makeIo({ DATABASE_URL: url });
      expect(await runCli(["row-counts", "--out=before.json"], io)).toBe(0);
      expect(out.join("")).toBe("row-counts: users 1\nrow-counts: billing.subscriptions 0\n");
      await runSql(url, "INSERT INTO billing.subscriptions VALUES (1);");
      out = [];
      expect(await runCli(["row-counts", "--compare=before.json"], io)).toBe(0);
      expect(out.join("")).toBe("row-counts: users 1 -> 1 (0)\nrow-counts: billing.subscriptions 0 -> 1 (+1)\n");
    });

    it("reads the tables from the file --config names", async () => {
      const url = await createTestDatabase();
      await runSql(url, "CREATE TABLE notes (id int); INSERT INTO notes VALUES (1), (2);");
      mkdirSync(join(dir, "config"));
      writeFileSync(join(dir, "config", "prod.json"), JSON.stringify({ database: { rowCountTables: ["notes"] } }));
      expect(await runCli(["row-counts", "--config=config/prod.json"], makeIo({ DATABASE_URL: url }))).toBe(0);
      expect(out.join("")).toBe("row-counts: notes 2\n");
    });

    it("counts a table the old schema lacks as absent and passes when the release creates it", async () => {
      const url = await createTestDatabase();
      await runSql(url, "CREATE TABLE users (id int); INSERT INTO users VALUES (1);");
      const io = makeIo({ DATABASE_URL: url });
      expect(await runCli(["row-counts", "--tables=users,notes", "--out=before.json"], io)).toBe(0);
      expect(out.join("")).toBe("row-counts: users 1\nrow-counts: notes absent\n");
      const saved = JSON.parse(readFileSync(join(dir, "before.json"), "utf8")) as { counts: unknown };
      expect(saved.counts).toEqual({ users: 1, notes: null });
      await runSql(url, "CREATE TABLE notes (id int);");
      out = [];
      expect(await runCli(["row-counts", "--tables=users,notes", "--compare=before.json"], io)).toBe(0);
      expect(out.join("")).toBe("row-counts: users 1 -> 1 (0)\nrow-counts: notes absent -> 0 (created by this release)\n");
      expect(err.join("")).toBe("");
    });

    it("compares the snapshots psql prints from the --print-query statement, absent tables included", async () => {
      const url = await createTestDatabase();
      await runSql(url, "CREATE SCHEMA billing; CREATE TABLE users (id int); CREATE TABLE billing.subscriptions (id int); INSERT INTO users VALUES (1), (2);");
      const command = ["row-counts", "--tables=users,billing.subscriptions,notes"];
      const before = await runPrintedQuery(url, command);
      expect(JSON.parse(before)).toEqual({ users: 2, "billing.subscriptions": 0, notes: null });
      expect(await runCli([...command, "--stdin", "--out=before.json"], makeIo({}, before))).toBe(0);
      expect(out.join("")).toBe("row-counts: users 2\nrow-counts: billing.subscriptions 0\nrow-counts: notes absent\n");
      await runSql(url, "DELETE FROM users WHERE id = 2; CREATE TABLE notes (id int);");
      out = [];
      const after = await runPrintedQuery(url, command);
      expect(await runCli([...command, "--stdin", "--compare=before.json"], makeIo({}, after))).toBe(1);
      expect(out.join("")).toBe(
        "row-counts: users 2 -> 1 (-1)\nrow-counts: billing.subscriptions 0 -> 0 (0)\nrow-counts: notes absent -> 0 (created by this release)\n",
      );
      expect(err.join("")).toBe("row-counts: the deploy lost rows or tables: users (fewer rows than before).\n");
    });

    it("fails when a table counted before is absent after the deploy", async () => {
      const url = await createTestDatabase();
      await runSql(url, "CREATE TABLE users (id int); INSERT INTO users VALUES (1), (2);");
      const io = makeIo({ DATABASE_URL: url });
      expect(await runCli(["row-counts", "--tables=users", "--out=before.json"], io)).toBe(0);
      await runSql(url, "DROP TABLE users;");
      out = [];
      expect(await runCli(["row-counts", "--tables=users", "--compare=before.json"], io)).toBe(1);
      expect(out.join("")).toBe("row-counts: users 2 -> absent\n");
      expect(err.join("")).toBe("row-counts: the deploy lost rows or tables: users (absent after the deploy).\n");
    });
  });
});

describe("softure-deploy database commands without a database", () => {
  it("refuses a missing URL variable by its name", async () => {
    expect(await runCli(["schema-guard", "--migrations-dir=x"], makeIo({}))).toBe(1);
    expect(await runCli(["backup", "--url-env=PROD_DB"], makeIo({}))).toBe(1);
    expect(err.join("")).toBe(
      "schema-guard: DATABASE_URL is not set; it must hold the database URL.\nbackup: PROD_DB is not set; it must hold the database URL.\n",
    );
  });

  it("refuses a URL that is not a Postgres server, without echoing it", async () => {
    expect(await runCli(["row-counts", "--tables=users"], makeIo({ DATABASE_URL: "pglite://./data-sentinel" }))).toBe(1);
    expect(err.join("")).toBe("row-counts: DATABASE_URL must be a postgres:// or postgresql:// URL.\n");
  });

  it("treats a bad flag value as a usage error", async () => {
    const io = makeIo({ DATABASE_URL: "postgres://db/app" });
    expect(await runCli(["backup", "--keep=0"], io)).toBe(2);
    expect(await runCli(["backup", "--prefix=../x"], io)).toBe(2);
    expect(await runCli(["schema-guard"], io)).toBe(2);
    expect(await runCli(["row-counts"], io)).toBe(2);
    expect(await runCli(["row-counts", "--tables=Users"], io)).toBe(2);
    expect(err.join("")).toBe(
      [
        'backup: --keep must be a whole number of at least 1, got "0".',
        'backup: --prefix must be lower case letters, digits, - and _, got "../x".',
        "schema-guard: --migrations-dir is required (the folder of `softure migrate --export-migrations`).",
        "row-counts: no tables to count; pass --tables=users,billing.subscriptions or list them in database.rowCountTables of deploy.json (deploy.json not found).",
        "row-counts: not a table name (table or schema.table, lower snake case): Users.",
        "",
      ].join("\n"),
    );
  });

  it("names a pg_dump it cannot find and writes nothing", async () => {
    const io = makeIo({ DATABASE_URL: "postgres://user:sentinel-password@db/app" });
    expect(await runCli(["backup", "--pg-dump=/nonexistent/pg_dump"], io)).toBe(1);
    expect(err.join("")).toBe(
      "backup: no backup written; /nonexistent/pg_dump not found; install the PostgreSQL client or pass --pg-dump=<path>.\n",
    );
    expect(readdirSync(join(dir, "backups"))).toEqual([]);
    expect(existsSync(join(dir, "backups"))).toBe(true);
    expect(err.join("")).not.toContain("sentinel-password");
  });

  /** A stand-in for pg_dump: records its arguments and writes `output` to stdout. */
  function writeFakePgDump(output: string): string {
    const path = join(dir, "fake-pg-dump.sh");
    writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' "$@" > "${join(dir, "args.txt")}"\nprintf '%s' '${output}'\n`, { mode: 0o755 });
    return path;
  }

  it("passes each excluded table to pg_dump and removes dumps past --max-age-days", async () => {
    const backups = join(dir, "backups");
    mkdirSync(backups);
    for (const name of ["db-20000101T000000Z.dump", "db-20000102T000000Z.dump"]) writeFileSync(join(backups, name), "PGDMP old");
    const pgDump = writeFakePgDump("PGDMP fake");
    const args = ["backup", `--pg-dump=${pgDump}`, "--max-age-days=30", "--exclude-table-data=auth_attempts,audit.ip_log"];
    expect(await runCli(args, makeIo({ DATABASE_URL: "postgres://db/app" }))).toBe(0);
    expect(readFileSync(join(dir, "args.txt"), "utf8").split("\n")).toEqual([
      "--format=custom",
      "--no-password",
      "--exclude-table-data=auth_attempts",
      "--exclude-table-data=audit.ip_log",
      "",
    ]);
    const left = readdirSync(backups);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatch(/^db-\d{8}T\d{6}Z\.dump$/);
    expect(out.join("")).toContain("removed 2 older: db-20000102T000000Z.dump, db-20000101T000000Z.dump");
  });

  it("keeps no file that is not a custom-format dump and runs no retention", async () => {
    const backups = join(dir, "backups");
    mkdirSync(backups);
    writeFileSync(join(backups, "db-20000101T000000Z.dump"), "PGDMP old");
    const pgDump = writeFakePgDump("-- plain SQL");
    expect(await runCli(["backup", `--pg-dump=${pgDump}`, "--keep=1"], makeIo({ DATABASE_URL: "postgres://db/app" }))).toBe(1);
    expect(readdirSync(backups)).toEqual(["db-20000101T000000Z.dump"]);
    expect(err.join("")).toBe(`backup: no backup written; ${pgDump} wrote no pg_dump custom-format file (no PGDMP header).\n`);
  });

  it("refuses a bad --max-age-days or --exclude-table-data as a usage error", async () => {
    const io = makeIo({ DATABASE_URL: "postgres://db/app" });
    expect(await runCli(["backup", "--max-age-days=0"], io)).toBe(2);
    expect(await runCli(["backup", "--exclude-table-data=Auth"], io)).toBe(2);
    expect(err.join("")).toBe(
      [
        'backup: --max-age-days must be a whole number of at least 1, got "0".',
        "backup: --exclude-table-data: not a table name (table or schema.table, lower snake case): Auth.",
        "",
      ].join("\n"),
    );
  });

  it("refuses a row-counts file that is not one", async () => {
    writeFileSync(join(dir, "before.json"), JSON.stringify({ counts: { users: -1 } }));
    expect(await runCli(["row-counts", "--tables=users", "--compare=before.json"], makeIo({ DATABASE_URL: "postgres://db/app" }))).toBe(1);
    expect(err.join("")).toMatch(/^row-counts: before\.json is not a row-counts file: .+\.\n$/);
  });

  it("asks for the tables when deploy.json has no list", async () => {
    writeFileSync(join(dir, "deploy.json"), JSON.stringify({ verify: { routes: [{ path: "/" }] } }));
    expect(await runCli(["row-counts"], makeIo({ DATABASE_URL: "postgres://db/app" }))).toBe(2);
    expect(err.join("")).toBe(
      "row-counts: no tables to count; pass --tables=users,billing.subscriptions or list them in database.rowCountTables of deploy.json.\n",
    );
  });

  it("refuses an invalid deploy.json with its issues and a --config file it cannot read", async () => {
    writeFileSync(join(dir, "deploy.json"), JSON.stringify({ database: { rowCountTables: ["Users"] } }));
    const io = makeIo({ DATABASE_URL: "postgres://db/app" });
    expect(await runCli(["row-counts"], io)).toBe(1);
    expect(await runCli(["row-counts", "--config=missing.json"], io)).toBe(1);
    expect(err.join("")).toBe(
      [
        "row-counts: deploy.json is not valid:",
        "  database.rowCountTables.0: a table or schema.table in lower snake case",
        "row-counts: cannot read missing.json (ENOENT).",
        "",
      ].join("\n"),
    );
  });

  it("refuses --tables together with --config", async () => {
    expect(await runCli(["row-counts", "--tables=users", "--config=deploy.json"], makeIo({ DATABASE_URL: "postgres://db/app" }))).toBe(2);
    expect(err.join("")).toBe("row-counts: pass either --tables or --config, not both.\n");
  });

  it("does not read deploy.json when --tables is given", async () => {
    writeFileSync(join(dir, "deploy.json"), "{ not json");
    expect(await runCli(["row-counts", "--tables=users"], makeIo({ DATABASE_URL: "pglite://./data" }))).toBe(1);
    expect(err.join("")).toBe("row-counts: DATABASE_URL must be a postgres:// or postgresql:// URL.\n");
  });
});

describe("softure-deploy --stdin modes without a database", () => {
  const LEDGER = JSON.stringify({ softure: [], app: { ledger: "drizzle.__drizzle_migrations", rows: 4 } });

  it("prints the snapshot statements without a database, and nothing else", async () => {
    expect(await runCli(["schema-guard", "--print-query"], makeIo({}))).toBe(0);
    expect(await runCli(["row-counts", "--tables=users", "--print-query"], makeIo({}))).toBe(0);
    const [ledger, counts] = out;
    expect(ledger).toMatch(/^SELECT json_build_object\('softure', .*'app', NULL::json\)::text AS snapshot\n$/);
    expect(counts).toMatch(/^SELECT \(jsonb_build_object\('users', \(CASE WHEN to_regclass\('"users"'\) IS NULL .*\)::text AS snapshot\n$/);
    expect(err).toEqual([]);
  });

  it("refuses the app ledger when the snapshot was printed for another or none", async () => {
    writeExport("image", { "0001_create_notes.sql": NOTES_0001 });
    writeAppJournal("journal.json", 5);
    const none = JSON.stringify({ softure: [], app: null });
    expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=journal.json", "--stdin"], makeIo({}, none))).toBe(1);
    expect(err.join("")).toContain(
      "  the snapshot holds no rows of drizzle.__drizzle_migrations; print the query with --app-ledger=drizzle.__drizzle_migrations\n",
    );
    expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=journal.json", "--stdin"], makeIo({}, LEDGER))).toBe(0);
    expect(out.join("")).toContain("drizzle.__drizzle_migrations: the image knows 5, the database ran 4\n");
  });

  it("refuses an empty or foreign snapshot on stdin, naming the query to pipe", async () => {
    writeExport("image", { "0001_create_notes.sql": NOTES_0001 });
    expect(await runCli(["schema-guard", "--migrations-dir=image", "--stdin"], makeIo({}))).toBe(1);
    expect(await runCli(["schema-guard", "--migrations-dir=image", "--stdin"], makeIo({}, '{"softure":[{"module":"notes"}],"app":null}'))).toBe(1);
    expect(await runCli(["row-counts", "--tables=users,notes", "--stdin"], makeIo({}, '{"users":1}'))).toBe(1);
    expect(err.join("").split("\n")).toEqual([
      'schema-guard: the snapshot is empty on stdin; pipe the output of `psql -At -c "$(softure-deploy schema-guard --print-query …)"`.',
      'schema-guard: the snapshot is not a ledger snapshot (softure.0.version: Invalid input: expected number, received undefined) on stdin; pipe the output of `psql -At -c "$(softure-deploy schema-guard --print-query …)"`.',
      'row-counts: the snapshot has no count of notes on stdin; pipe the output of `psql -At -c "$(softure-deploy row-counts --print-query …)"`.',
      "",
    ]);
  });

  it("refuses an app journal it cannot read and an --app-ledger without a journal", async () => {
    writeExport("image", { "0001_create_notes.sql": NOTES_0001 });
    writeFileSync(join(dir, "broken.json"), "{");
    expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=missing.json", "--stdin"], makeIo({}, LEDGER))).toBe(1);
    expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-journal=broken.json", "--stdin"], makeIo({}, LEDGER))).toBe(1);
    expect(await runCli(["schema-guard", "--migrations-dir=image", "--app-ledger=x", "--stdin"], makeIo({}, LEDGER))).toBe(2);
    expect(await runCli(["schema-guard", "--app-ledger=Bad-Name", "--print-query"], makeIo({}))).toBe(2);
    expect(err.join("").split("\n")).toEqual([
      `schema-guard: cannot read the app journal ${join(dir, "missing.json")} (ENOENT).`,
      `schema-guard: cannot read the app journal ${join(dir, "broken.json")} (not JSON).`,
      "schema-guard: --app-ledger needs --app-journal (the image's journal of that ledger).",
      'schema-guard: --app-ledger must be one table or schema.table, got "Bad-Name".',
      "",
    ]);
  });

  it("keeps a finished custom-format dump from stdin with mode 0600 and runs the retention", async () => {
    mkdirSync(join(dir, "backups"));
    for (const day of ["01", "02", "03"]) writeFileSync(join(dir, "backups", `db-202610${day}T120000Z.dump`), "PGDMP old");
    const dump = Buffer.concat([Buffer.from("PGDMP"), randomBytes(64)]);
    expect(await runCli(["backup", "--stdin", "--keep=2"], makeIo({}, dump))).toBe(0);
    const kept = readdirSync(join(dir, "backups")).sort();
    expect(kept).toHaveLength(2);
    expect(kept[0]).toBe("db-20261003T120000Z.dump");
    const newest = join(dir, "backups", kept[1] ?? "");
    expect(readFileSync(newest)).toEqual(dump);
    expect(statSync(newest).mode & 0o777).toBe(0o600);
    expect(out.join("")).toMatch(/^backup: wrote .*db-\d{8}T\d{6}Z\.dump \(69 bytes\); removed 2 older: db-20261002T120000Z\.dump, db-20261001T120000Z\.dump\n$/);
  });

  it("refuses an empty or foreign input and the flags of the pg_dump that made the dump", async () => {
    expect(await runCli(["backup", "--stdin"], makeIo({}))).toBe(1);
    expect(await runCli(["backup", "--stdin"], makeIo({}, "not a dump"))).toBe(1);
    expect(await runCli(["backup", "--stdin", "--pg-dump=/x", "--exclude-table-data=a"], makeIo({}, "PGDMP"))).toBe(2);
    expect(err.join("").split("\n")).toEqual([
      "backup: no backup written; the input wrote no pg_dump custom-format file (no PGDMP header).",
      "backup: no backup written; the input wrote no pg_dump custom-format file (no PGDMP header).",
      "backup: --stdin takes a finished dump; --pg-dump, --exclude-table-data belong to the pg_dump that made it.",
      "",
    ]);
    expect(readdirSync(join(dir, "backups"))).toEqual([]);
  });
});
