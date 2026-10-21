import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closeReusedTestDatabases, createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { copyFixtureMigrations, createNotesModule, createTagsModule } from "./fixtures/modules.js";

// `notes` with a migration that seeds one row and a materialized view over the table.
const seeded = copyFixtureMigrations("notes");
writeFileSync(
  join(seeded.path, "0003_seed.sql"),
  [
    "-- Rollback: DROP MATERIALIZED VIEW notes.note_count; DELETE FROM notes.notes WHERE title = 'seed';",
    "INSERT INTO notes (title) VALUES ('seed');",
    "CREATE MATERIALIZED VIEW note_count AS SELECT count(*)::int AS count FROM notes;",
    "",
  ].join("\n"),
);
const MODULES = [createNotesModule(seeded.dir), createTagsModule()];
const held: TestDatabase[] = [];

async function take(): Promise<TestDatabase> {
  const database = await createTestDatabase(MODULES, { reuse: true });
  held.push(database);
  return database;
}

async function readTitles(database: TestDatabase): Promise<string[]> {
  const rows = await database.db.execute<{ title: string }>(sql`select title from notes.notes order by id`);
  return rows.rows.map((row) => row.title);
}

// The id a new copy of the template gives (PGlite's sequences resume past their logged values, so not simply 2).
async function insertIntoFreshCopy(): Promise<{ id: number }[]> {
  const fresh = await createTestDatabase(MODULES);
  try {
    return (await fresh.db.execute<{ id: number }>(sql`insert into notes.notes (title) values ('second') returning id`)).rows;
  } finally {
    await fresh.close();
  }
}

afterEach(async () => {
  for (const database of held.splice(0)) await database.close();
});
afterAll(async () => {
  await closeReusedTestDatabases();
  seeded.cleanup();
});

describe("createTestDatabase with reuse", () => {
  it("hands a closed database out again with the template's rows, ledger and sequences", async () => {
    const first = await take();
    await first.db.execute(sql`insert into notes.notes (title) values ('from the first test')`);
    await first.db.execute(sql`insert into tags.tags (note_id, label) select id, 'red' from notes.notes`);
    const ledgerBefore = await first.client.query<{ count: number }>("select count(*)::int as count from softure.migrations");
    await first.close();

    const second = await take();
    const inserted = await second.db.execute<{ id: number }>(sql`insert into notes.notes (title) values ('second') returning id`);
    const tags = await second.db.execute<{ count: number }>(sql`select count(*)::int as count from tags.tags`);
    const ledgerAfter = await second.client.query<{ count: number }>("select count(*)::int as count from softure.migrations");
    const view = await second.db.execute<{ count: number }>(sql`select count from notes.note_count`);

    expect(second.client).toBe(first.client);
    expect(await readTitles(second)).toEqual(["seed", "second"]);
    expect(inserted.rows).toEqual(await insertIntoFreshCopy());
    expect(tags.rows).toEqual([{ count: 0 }]);
    expect(ledgerAfter.rows).toEqual(ledgerBefore.rows);
    expect(view.rows).toEqual([{ count: 1 }]);
  });

  it("never shares an instance between two open databases", async () => {
    const first = await take();
    const second = await take();
    await first.db.execute(sql`insert into notes.notes (title) values ('only in first')`);

    expect(second.client).not.toBe(first.client);
    expect(await readTitles(second)).toEqual(["seed"]);
  });

  it("replaces a database whose schema a test changed", async () => {
    const first = await take();
    await first.client.exec("ALTER TABLE notes.notes ADD COLUMN extra text; CREATE TABLE public.scratch (id int)");
    await first.close();

    const second = await take();
    const scratch = await second.client.query<{ name: string | null }>("select to_regclass('public.scratch')::text as name");

    expect(second.client).not.toBe(first.client);
    expect(scratch.rows).toEqual([{ name: null }]);
  });

  it("replaces a database left inside a transaction", async () => {
    const first = await take();
    await first.client.exec("BEGIN; INSERT INTO notes.notes (title) VALUES ('uncommitted')");
    await first.close();

    const second = await take();

    expect(second.client).not.toBe(first.client);
    expect(await readTitles(second)).toEqual(["seed"]);
  });

  it("does not carry session settings or temporary tables into the next test", async () => {
    const first = await take();
    await first.client.exec("SET TIME ZONE 'Asia/Tokyo'; CREATE TEMP TABLE scratch (id int)");
    await first.close();

    const second = await take();
    const zone = await second.client.query<{ zone: string }>("select current_setting('TimeZone') as zone");
    const scratch = await second.client.query<{ name: string | null }>("select to_regclass('pg_temp.scratch')::text as name");

    expect(second.client).toBe(first.client);
    expect(zone.rows[0]?.zone).not.toBe("Asia/Tokyo");
    expect(scratch.rows).toEqual([{ name: null }]);
  });

  it("takes a second close without returning the database twice", async () => {
    const first = await take();
    await first.close();
    await first.close();

    const second = await take();
    const third = await take();

    expect(second.client).toBe(first.client);
    expect(third.client).not.toBe(first.client);
  });

  it("closes the idle databases, and a held one when it comes back", async () => {
    const idle = await take();
    const held = await take();
    await idle.close();

    await closeReusedTestDatabases();
    await held.close();
    const next = await take();

    expect(idle.client.closed).toBe(true);
    expect(held.client.closed).toBe(true);
    expect(next.client).not.toBe(idle.client);
  });

  it("resets in milliseconds, not by booting a copy", async () => {
    const warm = await take();
    await warm.close();

    const started = performance.now();
    const again = await take();
    const elapsed = performance.now() - started;

    expect(again.client).toBe(warm.client);
    // A copy of the template takes ~400 ms here; a reset of these tables a few. The bound is wide for loaded runners.
    expect(elapsed).toBeLessThan(250);
  });
});
