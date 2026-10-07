// The database the modules use: one process-wide handle per URL, shared with every module adapter, so
// the app holds one pool (a second handle on a pglite:// directory would corrupt it). `next dev`
// re-evaluates modules on every change; the shared handle lives on globalThis, so reloads reuse it.
import { getSharedDatabase, type DatabaseHandle } from "@softure-ai/db";
import config from "../softure.config.ts";

export function getDatabase(): Promise<DatabaseHandle> {
  if (config.database === null) {
    throw new Error("getDatabase: softure.config.ts has no database");
  }
  return getSharedDatabase(config.database.url);
}
