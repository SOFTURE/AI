// Test databases for module unit tests (docs/02-module-standard.md §10): a real Postgres (PGlite)
// with the real migrations of the given modules. Migrating costs about two seconds, so each
// module set is migrated once per test worker into a template, and every call starts from a copy
// of the template's data folder (FIRE_TRACKER `src/db/test-db.ts`). An app with its own migrations
// passes the same `app` hooks as to `migrate`, so module tables can reference app tables.
import { PGlite } from "@electric-sql/pglite";
import type { AnySoftureModule } from "@softure-ai/core";
import { createPgliteHandle, type PgliteClientDatabase } from "./client.js";
import { migrate, type AppMigrationHook, type AppMigrations } from "./migrations/migrator.js";
import { describeProblem } from "./migrations/problems.js";

export interface TestDatabase {
  readonly db: PgliteClientDatabase;
  readonly client: PGlite;
  readonly close: () => Promise<void>;
}

export interface CreateTestDatabaseOptions {
  /**
   * The app's own migrations, run around the module files as `migrate` runs them. The template is
   * cached per hook object: define the hooks once, at module level, not inline per call.
   */
  readonly app?: AppMigrations;
}

const templates = new Map<string, Promise<Blob | File>>();
const hookIds = new WeakMap<AppMigrationHook, number>();
let nextHookId = 1;

/**
 * A fresh, migrated, in-memory database per call. List the module under test and the modules it
 * depends on. Throws when a migration (a module file or an app hook) fails: that is a bug in the
 * module package or the app's migrations.
 */
export async function createTestDatabase(modules: readonly AnySoftureModule[] = [], options: CreateTestDatabaseOptions = {}): Promise<TestDatabase> {
  const client = new PGlite({ loadDataDir: await getTemplate(modules, options.app ?? {}) });
  const handle = await createPgliteHandle(client);
  return { db: handle.db, client, close: handle.close };
}

function getTemplate(modules: readonly AnySoftureModule[], app: AppMigrations): Promise<Blob | File> {
  const moduleKey = modules.map((module) => `${module.id}@${module.migrations?.dir.href ?? "-"}`).join("|");
  const key = `${moduleKey}#before:${identifyHook(app.before)}#after:${identifyHook(app.after)}`;
  let template = templates.get(key);
  if (template === undefined) {
    template = buildTemplate(modules, app);
    templates.set(key, template);
    // A failed build is not cached: the next call reports the problem again.
    template.catch(() => templates.delete(key));
  }
  return template;
}

// Hooks are functions, so the key holds an id per hook object rather than its source text.
function identifyHook(hook: AppMigrationHook | undefined): string {
  if (hook === undefined) {
    return "-";
  }
  let id = hookIds.get(hook);
  if (id === undefined) {
    id = nextHookId++;
    hookIds.set(hook, id);
  }
  return String(id);
}

async function buildTemplate(modules: readonly AnySoftureModule[], app: AppMigrations): Promise<Blob | File> {
  const handle = await createPgliteHandle(new PGlite());
  try {
    const result = await migrate(handle, { modules, app });
    if (!result.ok) {
      throw new Error(`createTestDatabase: migrations failed:\n${result.problems.map(describeProblem).join("\n")}`);
    }
    return await handle.client.dumpDataDir("none");
  } finally {
    await handle.close();
  }
}
