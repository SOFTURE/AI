import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { copyFixtureMigrations, createNotesModule, createTagsModule } from "./fixtures/modules.js";

const opened: TestDatabase[] = [];
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
});
