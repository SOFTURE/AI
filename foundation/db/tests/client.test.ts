import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle, type Queryable } from "@softure-ai/db";
import { explainMissingDriver } from "../src/client.js";
import { POSTGRES_ADMIN_URL, createPostgresDatabaseUrl } from "./support/postgres.js";

const openHandles: DatabaseHandle[] = [];
const cleanups: (() => Promise<void> | void)[] = [];

async function open(url: string): Promise<DatabaseHandle> {
  const handle = await createDatabase(url);
  openHandles.push(handle);
  return handle;
}

afterEach(async () => {
  for (const handle of openHandles.splice(0)) await handle.close();
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function countRows(db: Queryable): Promise<number> {
  const result = await db.execute<{ count: number }>(sql`select count(*)::int as count from items`);
  return result.rows[0]?.count ?? -1;
}

describe("createDatabase", () => {
  it("opens an in-memory PGlite for pglite:// and runs queries through drizzle", async () => {
    const handle = await open("pglite://");

    const result = await handle.db.execute<{ answer: number }>(sql`select 1 + 1 as answer`);

    expect(handle.kind).toBe("pglite");
    expect(result.rows).toEqual([{ answer: 2 }]);
  });

  it("keeps PGlite data in the folder after the database is closed and reopened", async () => {
    const dir = mkdtempSync(join(tmpdir(), "softure-db-client-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    const first = await createDatabase(`pglite://${dir}`);
    await first.db.execute(sql`create table items (id int)`);
    await first.db.execute(sql`insert into items values (1), (2)`);
    await first.close();

    const second = await open(`pglite://${dir}`);

    expect(await countRows(second.db)).toBe(2);
  });

  it("lets one Queryable helper serve the database and a transaction", async () => {
    const handle = await open("pglite://");
    await handle.db.execute(sql`create table items (id int)`);

    const insideTransaction = await handle.db.transaction(async (tx) => {
      await tx.execute(sql`insert into items values (1)`);
      return countRows(tx);
    });

    expect(insideTransaction).toBe(1);
    expect(await countRows(handle.db)).toBe(1);
  });

  it("rejects an unsupported scheme without printing the URL", async () => {
    const attempt = createDatabase("mysql://admin:s3cret@db.example.com/app");

    await expect(attempt).rejects.toThrow('unsupported database URL scheme "mysql:"');
    await expect(attempt).rejects.not.toThrow(/s3cret/);
  });

  it("rejects a value with no scheme", async () => {
    await expect(createDatabase("localhost:5432")).rejects.toThrow('scheme "localhost:"');
  });

  it("refuses an empty URL and names the setting to fill", async () => {
    await expect(createDatabase("")).rejects.toThrow(
      "createDatabase: the database URL is empty; set database.url in softure.config (usually from DATABASE_URL)",
    );
  });

  it.runIf(POSTGRES_ADMIN_URL !== undefined)("opens a pg pool for postgres:// URLs", async () => {
    const { url, drop } = await createPostgresDatabaseUrl();
    cleanups.push(drop);
    const handle = await open(url);

    const result = await handle.db.execute<{ answer: number }>(sql`select 40 + 2 as answer`);

    expect(handle.kind).toBe("postgres");
    expect(result.rows).toEqual([{ answer: 42 }]);
  });
});

describe("explainMissingDriver", () => {
  function moduleNotFound(packageName: string, code = "ERR_MODULE_NOT_FOUND"): Error {
    return Object.assign(new Error(`Cannot find package '${packageName}' imported from /app/node_modules/@softure-ai/db/dist/client.js`), { code });
  }

  it("names the driver to install when the driver package itself is missing", () => {
    const missing = moduleNotFound("pg");

    const explained = explainMissingDriver(missing, { packageName: "pg", scheme: "postgres://" });

    expect(explained).toBeInstanceOf(Error);
    expect((explained as Error).message).toBe(
      'createDatabase: postgres:// URLs need the "pg" package, which is not installed; run `npm install pg` ' +
        'and, in a Next.js app, list "@softure-ai/db" and "pg" in serverExternalPackages (db README §2)',
    );
    expect((explained as Error).cause).toBe(missing);
  });

  it("names the driver when drizzle's adapter fails on it, also for a CommonJS loader's code", () => {
    const missing = moduleNotFound("@electric-sql/pglite", "MODULE_NOT_FOUND");

    const explained = explainMissingDriver(missing, { packageName: "@electric-sql/pglite", scheme: "pglite://" });

    expect((explained as Error).message).toBe(
      'createDatabase: pglite:// URLs need the "@electric-sql/pglite" package, which is not installed; run ' +
        '`npm install @electric-sql/pglite` and, in a Next.js app, list "@softure-ai/db" and "@electric-sql/pglite" ' +
        "in serverExternalPackages (db README §2)",
    );
  });

  it("returns any other error unchanged", () => {
    const otherPackage = moduleNotFound("pg-types");
    const otherCode = Object.assign(new Error("Cannot find package 'pg'"), { code: "ERR_INVALID_URL" });
    const plain = new Error("boom");

    expect(explainMissingDriver(otherPackage, { packageName: "pg", scheme: "postgres://" })).toBe(otherPackage);
    expect(explainMissingDriver(otherCode, { packageName: "pg", scheme: "postgres://" })).toBe(otherCode);
    expect(explainMissingDriver(plain, { packageName: "pg", scheme: "postgres://" })).toBe(plain);
    expect(explainMissingDriver("not an error", { packageName: "pg", scheme: "postgres://" })).toBe("not an error");
  });
});
