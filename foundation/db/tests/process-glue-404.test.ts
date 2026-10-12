// The glue an app on createProcessDatabase wrote around the package (issue #404): a process database kept on
// globalThis across re-evaluation, closing every process database, drizzle app migrations and raw queries.
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  closeProcessDatabases,
  closeSharedDatabases,
  createProcessDatabase,
  drizzleAppMigrations,
  migrate,
  openRawDatabase,
  queryDatabase,
} from "@softure-ai/db";
import { createTestDrivers } from "./support/drivers.js";
import { hasRelation } from "./support/query.js";

const URL_PGLITE = "pglite://";
const APP_DRIZZLE_URL = new URL("./fixtures/app-drizzle/", import.meta.url);

afterEach(async () => {
  await closeProcessDatabases();
  await closeSharedDatabases();
});

describe("createProcessDatabase with globalKey", () => {
  it("shares the open database with a second evaluation that uses the same key", async () => {
    const first = createProcessDatabase(URL_PGLITE, { globalKey: "glue-404-shared" });
    const reloaded = createProcessDatabase(URL_PGLITE, { globalKey: "glue-404-shared" });

    const handle = await first.open();

    expect(reloaded.isOpen()).toBe(true);
    expect(await reloaded.open()).toBe(handle);
    const rows = await reloaded.db.execute<{ answer: number }>(sql`select 40 + 2 as answer`);
    expect(rows.rows).toEqual([{ answer: 42 }]);
  });

  it("closing through one evaluation closes it for the other", async () => {
    const first = createProcessDatabase(URL_PGLITE, { globalKey: "glue-404-close" });
    const reloaded = createProcessDatabase(URL_PGLITE, { globalKey: "glue-404-close" });
    await first.open();

    await reloaded.close();

    expect(first.isOpen()).toBe(false);
    expect(() => first.db.select()).toThrow("Database is not open");
  });

  it("keeps two databases without a key apart", async () => {
    const first = createProcessDatabase(URL_PGLITE);
    const second = createProcessDatabase(URL_PGLITE);

    await first.open();

    expect(second.isOpen()).toBe(false);
  });
});

describe("closeProcessDatabases", () => {
  it("closes every opened process database, keyed or not", async () => {
    const keyed = createProcessDatabase(URL_PGLITE, { globalKey: "glue-404-all" });
    const plain = createProcessDatabase("pglite://", {});
    await keyed.open();
    await plain.open();

    await closeProcessDatabases();

    expect(keyed.isOpen()).toBe(false);
    expect(plain.isOpen()).toBe(false);
    expect(() => plain.db.select()).toThrow("Database is not open");
  });

  it("does nothing when no process database is open", async () => {
    createProcessDatabase(URL_PGLITE);

    await expect(closeProcessDatabases()).resolves.toBeUndefined();
  });

  it("lets a closed database open again", async () => {
    const processDb = createProcessDatabase(URL_PGLITE);
    await processDb.open();
    await closeProcessDatabases();

    await processDb.open();

    expect(processDb.isOpen()).toBe(true);
  });
});

describe.each(createTestDrivers())("drizzleAppMigrations and queryDatabase on $name", (driver) => {
  afterEach(() => driver.cleanup());

  it("runs the app's drizzle folder as an app migration hook, given a path", async () => {
    const handle = await driver.open();

    const result = await migrate(handle, { modules: [], app: { before: drizzleAppMigrations(fileURLToPath(APP_DRIZZLE_URL)) } });

    expect(result.ok).toBe(true);
    expect(await hasRelation(handle, "public.app_users")).toBe(true);
  });

  it("accepts a file URL for the folder and skips what drizzle already applied", async () => {
    const handle = await driver.open();
    const hook = drizzleAppMigrations(APP_DRIZZLE_URL);

    await hook(handle);
    await hook(handle);

    expect(await hasRelation(handle, "public.app_users")).toBe(true);
  });

  it("runs a parameterized query and returns its rows", async () => {
    const handle = await driver.open();

    const rows = await queryDatabase<{ n: number; label: string }>(handle, "select $1::int as n, $2::text as label", [7, "seven"]);

    expect(rows).toEqual([{ n: 7, label: "seven" }]);
  });
});

describe("openRawDatabase", () => {
  it("opens the URL's driver, queries without values and closes", async () => {
    const raw = await openRawDatabase(URL_PGLITE);

    expect(raw.kind).toBe("pglite");
    expect(await raw.query<{ one: number }>("select 1 as one")).toEqual([{ one: 1 }]);
    await raw.close();
    await expect(raw.query("select 1")).rejects.toThrow();
  });

  it("refuses an unsupported URL scheme without naming the URL", async () => {
    await expect(openRawDatabase("mysql://user:secret@host/db")).rejects.toThrow('unsupported database URL scheme "mysql:"');
  });
});
