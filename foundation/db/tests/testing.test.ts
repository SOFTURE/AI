import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import type { AppMigrations } from "@softure-ai/db";
import { execSql } from "./support/query.js";
import { copyFixtureMigrations, createLinkedModule, createNotesModule, createTagsModule } from "./fixtures/modules.js";

const opened: TestDatabase[] = [];
let appUsersRuns = 0;
// Defined once, as an app would: the template is cached per hook object.
const APP_USERS: AppMigrations = {
  before: async (handle) => {
    appUsersRuns += 1;
    await execSql(handle, "CREATE TABLE public.app_users (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL)");
  },
};
// An app history that creates the notes table (the module's file 0001), declared as a baseline.
const NOTES_HISTORY: AppMigrations = {
  before: (handle) =>
    execSql(
      handle,
      "CREATE SCHEMA notes; CREATE TABLE notes.notes (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())",
    ),
  baseline: { notes: 1 },
};
const cleanups: (() => void)[] = [];

async function open(...args: Parameters<typeof createTestDatabase>): Promise<TestDatabase> {
  const database = await createTestDatabase(...args);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.close();
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("createTestDatabase", () => {
  it("gives a database with the tables of the listed modules", async () => {
    const database = await open([createNotesModule(), createTagsModule()]);

    await database.db.execute(sql`insert into notes.notes (title) values ('first')`);
    await database.db.execute(sql`insert into tags.tags (note_id, label) select id, 'red' from notes.notes`);
    const rows = await database.db.execute<{ label: string }>(sql`select label from tags.tags`);

    expect(rows.rows).toEqual([{ label: "red" }]);
  });

  it("gives every call its own database", async () => {
    const modules = [createNotesModule()];
    const first = await open(modules);
    const second = await open(modules);

    await first.db.execute(sql`insert into notes.notes (title) values ('only in first')`);
    const inSecond = await second.db.execute<{ count: number }>(sql`select count(*)::int as count from notes.notes`);

    expect(inSecond.rows).toEqual([{ count: 0 }]);
  });

  it("gives an empty database with only the ledger when no module is listed", async () => {
    const database = await open();

    const rows = await database.db.execute<{ module: string }>(sql`select module from softure.migrations`);

    expect(rows.rows).toEqual([{ module: "softure" }]);
  });

  it("throws naming the file when a migration fails", async () => {
    const copy = copyFixtureMigrations("notes");
    cleanups.push(copy.cleanup);
    writeFileSync(join(copy.path, "0003_broken.sql"), "-- Rollback: nothing.\nSELECT * FROM missing_table;\n");

    await expect(createTestDatabase([createNotesModule(copy.dir)])).rejects.toThrow(
      /createTestDatabase: migrations failed:\nnotes: migration 0003_broken\.sql failed and was rolled back: relation "missing_table" does not exist/,
    );
  });

  it("cannot build a module that references an app table without the app's migrations", async () => {
    await expect(createTestDatabase([createLinkedModule()])).rejects.toThrow(/linked: migration 0001_create_links\.sql failed and was rolled back: relation "public\.app_users" does not exist/);
  });

  it("runs the app's migrations before the modules and builds the template once per hook object", async () => {
    const runsBefore = appUsersRuns;

    const first = await open([createLinkedModule()], { app: APP_USERS });
    const second = await open([createLinkedModule()], { app: APP_USERS });
    await first.db.execute(sql`insert into public.app_users (email) values ('a@example.com')`);
    await first.db.execute(sql`insert into linked.links (user_id) select id from public.app_users`);
    const links = await first.db.execute<{ count: number }>(sql`select count(*)::int as count from linked.links`);
    const inSecond = await second.db.execute<{ count: number }>(sql`select count(*)::int as count from public.app_users`);

    expect(links.rows).toEqual([{ count: 1 }]);
    expect(inSecond.rows).toEqual([{ count: 0 }]);
    expect(appUsersRuns - runsBefore).toBe(1);
  });

  it("builds another template for another hook object", async () => {
    const seen: string[] = [];
    const other: AppMigrations = {
      before: async (handle) => {
        seen.push("other");
        await APP_USERS.before?.(handle);
      },
    };

    const database = await open([createLinkedModule()], { app: other });
    const rows = await database.db.execute<{ count: number }>(sql`select count(*)::int as count from linked.links`);

    expect(rows.rows).toEqual([{ count: 0 }]);
    expect(seen).toEqual(["other"]);
  });

  it("builds a fresh database from an app history with a baseline, the module adopted", async () => {
    const database = await open([createNotesModule()], { app: NOTES_HISTORY });
    const ledger = await database.db.execute<{ module: string; version: number; method: string }>(
      sql`select module, version, method from softure.migrations where module = 'notes' order by version`,
    );

    expect(ledger.rows).toEqual([
      { module: "notes", version: 1, method: "adopted" },
      { module: "notes", version: 2, method: "applied" },
    ]);
  });
});
