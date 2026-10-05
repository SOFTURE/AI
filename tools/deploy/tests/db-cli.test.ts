// The database commands on a real Postgres: a fresh database per test on the server in
// SOFTURE_TEST_POSTGRES_URL (the CI service; locally the cases skip without it, as in @softure-ai/db).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

function makeIo(env: Record<string, string | undefined>): CliIo {
  return { cwd: dir, env: { PATH: process.env.PATH, ...env }, stdout: (text) => out.push(text), stderr: (text) => err.push(text) };
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
      expect(err.join("")).toBe("row-counts: fewer rows than before the deploy, or not counted before: users.\n");
    });

    it("reports a table that does not exist", async () => {
      const url = await createTestDatabase();
      expect(await runCli(["row-counts", "--tables=users"], makeIo({ DATABASE_URL: url }))).toBe(1);
      expect(err.join("")).toBe('row-counts: the database refused the step: relation "users" does not exist\n');
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
        "row-counts: --tables is required, e.g. --tables=users,billing.subscriptions.",
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

  it("refuses a row-counts file that is not one", async () => {
    writeFileSync(join(dir, "before.json"), JSON.stringify({ counts: { users: -1 } }));
    expect(await runCli(["row-counts", "--tables=users", "--compare=before.json"], makeIo({ DATABASE_URL: "postgres://db/app" }))).toBe(1);
    expect(err.join("")).toMatch(/^row-counts: before\.json is not a row-counts file: .+\.\n$/);
  });
});
