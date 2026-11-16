// The database the modules use, resolved the same way every module adapter resolves it: inside a request scope
// (`withRequestDatabase` in worker.ts on Cloudflare Workers) the request's own handle, otherwise one process-wide
// handle per URL on Node, so the app holds one pool (a second handle on a pglite:// directory would corrupt it).
import { getConfiguredDatabase, type DatabaseHandle } from "@softure-ai/db";
import config from "../softure.config.ts";

export function getDatabase(): Promise<DatabaseHandle> {
  if (config.database === null) {
    throw new Error("getDatabase: softure.config.ts has no database");
  }
  return getConfiguredDatabase(config.database);
}
