import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closeReusedTestDatabases, createTestDatabase, PoolInsideTransactionError, type TestDatabase } from "@softure-ai/db/testing";
import { createNotesModule } from "./fixtures/modules.js";

const MODULES = [createNotesModule()];
const held: TestDatabase[] = [];

async function open(options: { reuse?: boolean } = {}): Promise<TestDatabase> {
  const database = await createTestDatabase(MODULES, options);
  held.push(database);
  return database;
}

async function countNotes(database: TestDatabase): Promise<number> {
  const rows = await database.db.execute<{ count: number }>(sql`select count(*)::int as count from notes.notes`);
  return rows.rows[0]?.count ?? -1;
}

// drizzle wraps a driver error in a DrizzleQueryError whose `cause` is the guard's error.
async function readGuardError(attempt: Promise<unknown>): Promise<PoolInsideTransactionError> {
  const error: unknown = await attempt.then(
    () => null,
    (reason: unknown) => reason,
  );
  const found = error instanceof PoolInsideTransactionError ? error : error instanceof Error ? error.cause : null;
  if (!(found instanceof PoolInsideTransactionError)) {
    throw new Error(`expected a PoolInsideTransactionError, got ${String(error)}`);
  }
  return found;
}

afterEach(async () => {
  await Promise.all(held.splice(0).map((database) => database.close()));
});
afterAll(() => closeReusedTestDatabases());

describe("createTestDatabase: a pool query inside a transaction (#785)", () => {
  it("rejects a drizzle query on db inside db.transaction at once and rolls the transaction back", async () => {
    const database = await open();
    const attempt = database.db.transaction(async (tx) => {
      await tx.execute(sql`insert into notes.notes (title) values ('inside')`);
      await database.db.execute(sql`select 1`);
    });
    const error = await readGuardError(attempt);
    expect(error.message).toBe(
      "createTestDatabase: query() on the database was called inside an open transaction of the same database. " +
        "PGlite has one connection, so the call would wait for that transaction forever. Run it through the " +
        "transaction's db instead (e.g. the db a processSyncItem callback gets, or { ...ctx, db: tx } for a helper " +
        "that takes a context).",
    );
    expect(await countNotes(database)).toBe(0);
  });

  it("names exec and transaction when the client's own methods are called inside a transaction", async () => {
    const database = await open();
    expect((await readGuardError(database.client.transaction(() => database.client.exec("select 1")))).message).toMatch(
      /^createTestDatabase: exec\(\) on the database was called inside an open transaction/,
    );
    const nested = database.client.transaction(() => database.client.transaction(() => Promise.resolve("nested")));
    expect((await readGuardError(nested)).message).toMatch(/^createTestDatabase: transaction\(\) on the database was called/);
  });

  it("runs queries through the transaction and commits them", async () => {
    const database = await open();
    const titles = await database.db.transaction(async (tx) => {
      await tx.execute(sql`insert into notes.notes (title) values ('a')`);
      return tx.transaction(async (savepoint) => (await savepoint.execute<{ title: string }>(sql`select title from notes.notes`)).rows);
    });
    expect(titles).toEqual([{ title: "a" }]);
    expect(await countNotes(database)).toBe(1);
  });

  it("lets unrelated concurrent work on the pool wait for the transaction and then run", async () => {
    const database = await open();
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transaction = database.db.transaction(async (tx) => {
      await tx.execute(sql`insert into notes.notes (title) values ('committed')`);
      await held;
    });
    const outside = countNotes(database);
    release();
    await transaction;
    expect(await outside).toBe(1);
  });

  it("lets work started inside a transaction query the pool once the transaction has ended", async () => {
    const database = await open();
    const later: Promise<number>[] = [];
    await database.db.transaction(async (tx) => {
      await tx.execute(sql`insert into notes.notes (title) values ('later')`);
      later.push(new Promise<void>((resolve) => setTimeout(resolve, 20)).then(() => countNotes(database)));
    });
    expect(await Promise.all(later)).toEqual([1]);
  });

  it("guards a database handed out again by reuse", async () => {
    const first = await createTestDatabase(MODULES, { reuse: true });
    await first.close();
    const again = await open({ reuse: true });
    expect(again.client).toBe(first.client);
    await readGuardError(again.db.transaction(() => again.db.execute(sql`select 1`)));
    expect(await countNotes(again)).toBe(0);
  });
});
