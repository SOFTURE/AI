// The app's own drizzle-kit migrations as an app migration hook: drizzle's migrator for the handle's driver,
// loaded only when the hook runs, so an app ships just its own driver.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppMigrationHook } from "./migrator.js";

export interface DrizzleAppMigrationsOptions {
  /** drizzle's ledger table for this folder. Default: `__drizzle_migrations`. */
  readonly migrationsTable?: string;
  /** The schema of that table. Default: `drizzle`. */
  readonly migrationsSchema?: string;
}

const DEFAULT_TABLE = "__drizzle_migrations";
const DEFAULT_SCHEMA = "drizzle";

interface DrizzleHookSource {
  /** `schema.table`, so `migrate` can refuse a `before` and an `after` sharing one (issue #534). */
  readonly ledger: string;
  /** The absolute folder, so a test template can be identified by its files across processes (issue #641). */
  readonly folder: string;
}

const sources = new WeakMap<AppMigrationHook, DrizzleHookSource>();

/**
 * A hook for `app.before` (or `app.after`) that applies the drizzle-kit folder (`meta/_journal.json` and its SQL
 * files) with drizzle's migrator. Drizzle skips what its ledger (`drizzle.__drizzle_migrations` unless `options`
 * names another) already holds, so the hook is safe on every `migrate` run. Drizzle reads only the newest row of the
 * ledger, so a second folder needs a ledger of its own. `folder` is a path (relative to the working directory) or a
 * file URL.
 */
export function drizzleAppMigrations(folder: string | URL, options: DrizzleAppMigrationsOptions = {}): AppMigrationHook {
  const migrationsFolder = typeof folder === "string" ? folder : fileURLToPath(folder);
  const config = {
    migrationsFolder,
    migrationsTable: options.migrationsTable ?? DEFAULT_TABLE,
    migrationsSchema: options.migrationsSchema ?? DEFAULT_SCHEMA,
  };
  const hook: AppMigrationHook = async (handle) => {
    if (handle.kind === "postgres") {
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(handle.db, config);
      return;
    }
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.db, config);
  };
  sources.set(hook, { ledger: `${config.migrationsSchema}.${config.migrationsTable}`, folder: resolve(migrationsFolder) });
  return hook;
}

/** The ledger (`schema.table`) a `drizzleAppMigrations` hook writes to; `undefined` for any other hook. */
export function getDrizzleLedger(hook: AppMigrationHook): string | undefined {
  return sources.get(hook)?.ledger;
}

/** The absolute folder a `drizzleAppMigrations` hook applies; `undefined` for any other hook. */
export function getDrizzleFolder(hook: AppMigrationHook): string | undefined {
  return sources.get(hook)?.folder;
}
