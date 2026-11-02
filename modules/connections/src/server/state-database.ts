// Where the token state is written: outside the caller's transaction. A refresh the provider accepted, the lease that
// guards it, `reconnect_required` and its hook cannot be undone at the provider, so they must not be undone in the
// database when the caller's transaction rolls back (issue #935: a `processSyncItem` item that fails). Inside a
// transaction the state goes through the app's configured database instead, the handle the module's adapters use; a
// single-connection database (PGlite) has nothing else to write on and keeps the caller's transaction.
import { getConfiguredDatabase } from "@softure-ai/db";
import { is } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import type { ConnectionsContext } from "./store.js";

const POSTGRES_PREFIXES = ["postgres://", "postgresql://"];

/**
 * `ctx` itself, or, when `ctx.db` is an open transaction (a savepoint included) on a Postgres the config names, `ctx`
 * with the configured pool as `db`. Opens nothing for a config without a Postgres database.
 */
export async function getStateContext(ctx: ConnectionsContext): Promise<ConnectionsContext> {
  if (!is(ctx.db, PgTransaction)) return ctx;
  const database = ctx.config.database;
  if (database === null) return ctx;
  if (database.handle === undefined && !POSTGRES_PREFIXES.some((prefix) => database.url.startsWith(prefix))) return ctx;
  const handle = await getConfiguredDatabase(database);
  return handle.kind === "postgres" ? { ...ctx, db: handle.db } : ctx;
}
