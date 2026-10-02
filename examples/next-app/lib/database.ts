// One database handle per server process. `next dev` re-evaluates modules on every change, so the
// handle lives on globalThis; otherwise each reload would open a new pool.
import { createDatabase, type DatabaseHandle } from "@softure-ai/db";
import config from "../softure.config.ts";

const cache = globalThis as typeof globalThis & { softureExampleDatabase?: Promise<DatabaseHandle> };

export function getDatabase(): Promise<DatabaseHandle> {
  if (config.database === null) {
    throw new Error("getDatabase: softure.config.ts has no database");
  }
  cache.softureExampleDatabase ??= createDatabase(config.database.url, { max: 5 });
  return cache.softureExampleDatabase;
}
