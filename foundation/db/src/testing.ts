// Test databases for module unit tests (docs/02-module-standard.md §10): a real Postgres (PGlite)
// with the real migrations of the given modules. Migrating costs about two seconds, so each
// module set is migrated once per test worker into a template, and every call starts from a copy
// of the template's data folder (FIRE_TRACKER `src/db/test-db.ts`).
import { PGlite } from "@electric-sql/pglite";
import type { AnySoftureModule } from "@softure-ai/core";
import { createPgliteHandle, type PgliteClientDatabase } from "./client.js";
import { migrate } from "./migrations/migrator.js";
import { describeProblem } from "./migrations/problems.js";

export interface TestDatabase {
  readonly db: PgliteClientDatabase;
  readonly client: PGlite;
  readonly close: () => Promise<void>;
}

const templates = new Map<string, Promise<Blob | File>>();

/**
 * A fresh, migrated, in-memory database per call. List the module under test and the modules it
 * depends on. Throws when a migration is invalid or fails: that is a bug in the module package.
 */
export async function createTestDatabase(modules: readonly AnySoftureModule[] = []): Promise<TestDatabase> {
  const client = new PGlite({ loadDataDir: await getTemplate(modules) });
  const handle = await createPgliteHandle(client);
  return { db: handle.db, client, close: handle.close };
}

function getTemplate(modules: readonly AnySoftureModule[]): Promise<Blob | File> {
  const key = modules.map((module) => `${module.id}@${module.migrations?.dir.href ?? "-"}`).join("|");
  let template = templates.get(key);
  if (template === undefined) {
    template = buildTemplate(modules);
    templates.set(key, template);
    // A failed build is not cached: the next call reports the problem again.
    template.catch(() => templates.delete(key));
  }
  return template;
}

async function buildTemplate(modules: readonly AnySoftureModule[]): Promise<Blob | File> {
  const handle = await createPgliteHandle(new PGlite());
  try {
    const result = await migrate(handle, { modules });
    if (!result.ok) {
      throw new Error(`createTestDatabase: migrations failed:\n${result.problems.map(describeProblem).join("\n")}`);
    }
    return await handle.client.dumpDataDir("none");
  } finally {
    await handle.close();
  }
}
