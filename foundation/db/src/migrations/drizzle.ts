// The app's own drizzle-kit migrations as an app migration hook: drizzle's migrator for the handle's driver,
// loaded only when the hook runs, so an app ships just its own driver.
import { fileURLToPath } from "node:url";
import type { AppMigrationHook } from "./migrator.js";

/**
 * A hook for `app.before` (or `app.after`) that applies the drizzle-kit folder (`meta/_journal.json` and its SQL
 * files) with drizzle's migrator. Drizzle skips what its ledger (`drizzle.__drizzle_migrations`) already holds, so
 * the hook is safe on every `migrate` run. `folder` is a path (relative to the working directory) or a file URL.
 */
export function drizzleAppMigrations(folder: string | URL): AppMigrationHook {
  const migrationsFolder = typeof folder === "string" ? folder : fileURLToPath(folder);
  return async (handle) => {
    if (handle.kind === "postgres") {
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(handle.db, { migrationsFolder });
      return;
    }
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.db, { migrationsFolder });
  };
}
