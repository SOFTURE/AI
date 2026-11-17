// createTestDatabase with PGlite extensions: a migration that needs an extension runs only when the extension is loaded,
// and every copy of the template has it.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { createFixtureModule } from "./fixtures/modules.js";

const opened: TestDatabase[] = [];
const cleanups: (() => void)[] = [];

afterEach(async () => {
  for (const database of opened.splice(0)) await database.close();
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** A module whose only migration creates the trigram extension and an index that needs it. */
function createTrigramModule() {
  const root = mkdtempSync(join(tmpdir(), "softure-db-trgm-"));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    join(root, "0001_create_words.sql"),
    "-- Rollback: DROP TABLE words.words; DROP EXTENSION pg_trgm;\nCREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;\nCREATE TABLE words (word text PRIMARY KEY);\nCREATE INDEX words_trgm_idx ON words USING gin (word public.gin_trgm_ops);\n",
  );
  return createFixtureModule({ id: "words", migrationsDir: pathToFileURL(`${root}/`) });
}

describe("createTestDatabase with extensions", () => {
  it("runs a migration that creates a loaded extension, and every copy can use it", async () => {
    const words = createTrigramModule();
    const first = await createTestDatabase([words], { extensions: { pg_trgm } });
    opened.push(first);
    await first.db.execute(sql`INSERT INTO words.words (word) VALUES ('spotkanie')`);
    const second = await createTestDatabase([words], { extensions: { pg_trgm } });
    opened.push(second);
    const result = await second.db.execute<{ score: number }>(sql`SELECT similarity('spotkanie', 'spotkania')::float8 AS score`);
    expect(Number(result.rows[0]?.score)).toBeGreaterThan(0.5);
    const rows = await second.db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM words.words`);
    expect(Number(rows.rows[0]?.count)).toBe(0);
  });

  it("fails the migration with a clear message when the extension is not loaded", async () => {
    await expect(createTestDatabase([createTrigramModule()])).rejects.toThrow(/createTestDatabase: migrations failed/);
  });
});
