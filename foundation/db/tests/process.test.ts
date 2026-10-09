import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it } from "vitest";
import { closeSharedDatabases, createProcessDatabase, getSharedDatabase } from "@softure-ai/db";

const notes = pgTable("notes", { body: text("body").notNull() });

const URL = "pglite://";

afterEach(async () => {
  await closeSharedDatabases();
});

describe("createProcessDatabase", () => {
  it("refuses a query before the database is opened, naming what to call", () => {
    const processDb = createProcessDatabase(URL);

    expect(processDb.isOpen()).toBe(false);
    expect(() => processDb.db.select()).toThrow(
      "Database is not open: call open() or withDatabase() at the process entry before querying",
    );
  });

  it("is not a thenable while closed, so awaiting it does not throw", async () => {
    const processDb = createProcessDatabase(URL);

    await expect(Promise.resolve(processDb.db)).resolves.toBe(processDb.db);
  });

  it("queries synchronously through db once opened, on the process-wide handle for the URL", async () => {
    const processDb = createProcessDatabase(URL);
    const handle = await processDb.open();

    await processDb.db.execute(sql`create table notes (body text not null)`);
    await processDb.db.insert(notes).values({ body: "hello" });

    expect(processDb.isOpen()).toBe(true);
    expect(handle).toBe(await getSharedDatabase(URL));
    expect(await processDb.db.select().from(notes)).toEqual([{ body: "hello" }]);
  });

  it("opens once: a second open returns the same handle", async () => {
    const processDb = createProcessDatabase(URL);

    const [first, second] = await Promise.all([processDb.open(), processDb.open()]);

    expect(second).toBe(first);
    expect(await processDb.open()).toBe(first);
  });

  it("reads the URL from a function on open, not when created", async () => {
    let url = "";
    const processDb = createProcessDatabase(() => url);
    url = URL;

    expect(await processDb.open()).toBe(await getSharedDatabase(URL));
  });

  it("closes the handle, after which db refuses queries and a new open gets a new handle", async () => {
    const processDb = createProcessDatabase(URL);
    const first = await processDb.open();

    await processDb.close();
    await processDb.close();

    expect(processDb.isOpen()).toBe(false);
    expect(() => processDb.db.select()).toThrow("Database is not open");
    expect(await processDb.open()).not.toBe(first);
  });

  it("withDatabase opens, runs main with db, closes and returns main's result", async () => {
    const processDb = createProcessDatabase(URL);

    const result = await processDb.withDatabase(async (db) => {
      const rows = await db.execute<{ answer: number }>(sql`select 1 + 1 as answer`);
      return rows.rows[0]?.answer;
    });

    expect(result).toBe(2);
    expect(processDb.isOpen()).toBe(false);
  });

  it("withDatabase closes the handle when main throws, and rethrows", async () => {
    const processDb = createProcessDatabase(URL);

    await expect(
      processDb.withDatabase(() => Promise.reject(new Error("import failed"))),
    ).rejects.toThrow("import failed");
    expect(processDb.isOpen()).toBe(false);
  });

  it("types and builds db with the schema it is given, so the relational query API works", async () => {
    const processDb = createProcessDatabase(URL, { schema: { notes } });
    await processDb.open();
    await processDb.db.execute(sql`create table notes (body text not null)`);
    await processDb.db.insert(notes).values({ body: "typed" });

    expect(await processDb.db.query.notes.findMany()).toEqual([{ body: "typed" }]);
  });

  it("rejects an open on an empty URL and stays closed", async () => {
    const processDb = createProcessDatabase("");

    await expect(processDb.open()).rejects.toThrow("the database URL is empty");
    expect(processDb.isOpen()).toBe(false);
  });
});
