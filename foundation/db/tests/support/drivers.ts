// The two drivers every migrator test runs on. PGlite databases start from a cached empty data
// folder (a fresh `new PGlite()` costs about 1.5 s of initdb); Postgres databases are created per
// test on the server in SOFTURE_TEST_POSTGRES_URL and dropped afterwards.
import { PGlite } from "@electric-sql/pglite";
import { createDatabase, type DatabaseHandle } from "@softure-ai/db";
import { createPgliteHandle } from "../../src/client.js";
import { POSTGRES_ADMIN_URL, createPostgresDatabaseUrl } from "./postgres.js";

export interface TestDriver {
  readonly name: "pglite" | "postgres";
  /** A new empty database; closed and removed by `cleanup`. */
  readonly open: () => Promise<DatabaseHandle>;
  readonly cleanup: () => Promise<void>;
}

let emptyPglite: Promise<Blob | File> | undefined;

function getEmptyPgliteDump(): Promise<Blob | File> {
  emptyPglite ??= (async () => {
    const client = new PGlite();
    try {
      return await client.dumpDataDir("none");
    } finally {
      await client.close();
    }
  })();
  return emptyPglite;
}

function createPgliteDriver(): TestDriver {
  const handles: DatabaseHandle[] = [];
  return {
    name: "pglite",
    open: async () => {
      const handle = await createPgliteHandle(new PGlite({ loadDataDir: await getEmptyPgliteDump() }));
      handles.push(handle);
      return handle;
    },
    cleanup: async () => {
      for (const handle of handles.splice(0)) await handle.close();
    },
  };
}

function createPostgresDriver(): TestDriver {
  const opened: { handle: DatabaseHandle; drop: () => Promise<void> }[] = [];
  return {
    name: "postgres",
    open: async () => {
      const { url, drop } = await createPostgresDatabaseUrl();
      const handle = await createDatabase(url);
      opened.push({ handle, drop });
      return handle;
    },
    cleanup: async () => {
      for (const { handle, drop } of opened.splice(0)) {
        await handle.close();
        await drop();
      }
    },
  };
}

/** PGlite always; Postgres when SOFTURE_TEST_POSTGRES_URL is set. */
export function createTestDrivers(): TestDriver[] {
  return POSTGRES_ADMIN_URL === undefined ? [createPgliteDriver()] : [createPgliteDriver(), createPostgresDriver()];
}
