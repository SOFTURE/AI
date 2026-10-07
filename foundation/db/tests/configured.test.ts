import { PGlite } from "@electric-sql/pglite";
import {
  closeConfiguredDatabases,
  closeSharedDatabases,
  createPgliteHandle,
  getConfiguredDatabase,
  getSharedDatabase,
  openCommandDatabase,
  type DatabaseHandle,
} from "@softure-ai/db";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

const NOT_A_HANDLE = "database.handle: the function must return a database handle; wrap the app's client with createPostgresHandle(pool) or createPgliteHandle(client) from @softure-ai/db";

describe("getConfiguredDatabase", () => {
  afterEach(async () => {
    await closeConfiguredDatabases();
    await closeSharedDatabases();
  });

  it("returns the app's handle and calls its function once", async () => {
    const appHandle = await createPgliteHandle(new PGlite());
    let calls = 0;
    const database = {
      url: "pglite://",
      handle: () => {
        calls += 1;
        return appHandle;
      },
    };

    const [first, second] = await Promise.all([getConfiguredDatabase(database), getConfiguredDatabase(database)]);
    const third = await getConfiguredDatabase(database);

    expect(first).toBe(appHandle);
    expect(second).toBe(appHandle);
    expect(third).toBe(appHandle);
    expect(calls).toBe(1);
  });

  it("queries the app's instance, not a second one on the url", async () => {
    const client = new PGlite();
    await client.exec("CREATE TABLE app_marker (id int); INSERT INTO app_marker VALUES (7);");
    const appHandle = await createPgliteHandle(client);

    const { db } = await getConfiguredDatabase({ url: "pglite://", handle: () => Promise.resolve(appHandle) });
    const rows = await db.execute<{ id: number }>(sql`SELECT id FROM app_marker`);

    expect(rows.rows).toEqual([{ id: 7 }]);
  });

  it("falls back to the shared handle for the url without a handle function", async () => {
    const shared = await getSharedDatabase("pglite://");
    expect(await getConfiguredDatabase({ url: "pglite://" })).toBe(shared);
  });

  it("refuses a function that returns something other than a handle, and asks again on the next call", async () => {
    let calls = 0;
    const database = {
      url: "pglite://",
      handle: (): DatabaseHandle => {
        calls += 1;
        return { kind: "pglite" } as unknown as DatabaseHandle;
      },
    };

    await expect(getConfiguredDatabase(database)).rejects.toThrow(NOT_A_HANDLE);
    await expect(getConfiguredDatabase(database)).rejects.toThrow(NOT_A_HANDLE);
    expect(calls).toBe(2);
  });

  it("does not keep a failed handle call", async () => {
    const appHandle = await createPgliteHandle(new PGlite());
    let calls = 0;
    const database = {
      url: "pglite://",
      handle: () => {
        calls += 1;
        if (calls === 1) throw new Error("app client not ready");
        return appHandle;
      },
    };

    await expect(getConfiguredDatabase(database)).rejects.toThrow("app client not ready");
    expect(await getConfiguredDatabase(database)).toBe(appHandle);
  });
});

describe("openCommandDatabase", () => {
  afterEach(async () => {
    await closeConfiguredDatabases();
    await closeSharedDatabases();
  });

  it("uses the app's handle, then closes and forgets it", async () => {
    const client = new PGlite();
    const appHandle = await createPgliteHandle(client);
    const reopened = await createPgliteHandle(new PGlite());
    let calls = 0;
    const database = {
      url: "pglite://",
      handle: () => {
        calls += 1;
        return calls === 1 ? appHandle : reopened;
      },
    };

    const command = await openCommandDatabase(database);
    expect(command.handle).toBe(appHandle);
    await command.close();

    expect(client.closed).toBe(true);
    expect(await getConfiguredDatabase(database)).toBe(reopened);
    expect(calls).toBe(2);
  });

  it("opens its own handle on the url without a handle function and closes it", async () => {
    const command = await openCommandDatabase({ url: "pglite://" });
    expect(command.handle.kind).toBe("pglite");
    expect(command.handle).not.toBe(await getSharedDatabase("pglite://"));
    await command.close();
    expect(command.handle.kind === "pglite" && command.handle.client.closed).toBe(true);
  });
});
