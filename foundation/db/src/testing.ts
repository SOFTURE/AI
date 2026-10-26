// Test databases for module unit tests (docs/02-module-standard.md §10): a real Postgres (PGlite)
// with the real migrations of the given modules. Migrating costs seconds, so each module set is
// migrated once into a template, and every call starts from a copy of the template's data folder
// (FIRE_TRACKER `src/db/test-db.ts`). The template is kept per test file, and per run when the
// global setup gives the run a folder (testing/template-store.ts). `reuse` hands back a used
// database reset to the template instead of a new copy (testing/reuse.ts). An app with its own
// migrations passes the same `app` hooks (and baseline) as to `migrate`, so module tables can
// reference app tables and a module the app's history already creates is adopted in the template.
import { PGlite } from "@electric-sql/pglite";
import type { AnySoftureModule } from "@softure-ai/core";
import { createPgliteHandle, type PgliteClientDatabase } from "./client.js";
import { migrate, type AppMigrationHook, type AppMigrations } from "./migrations/migrator.js";
import { describeProblem } from "./migrations/problems.js";
import { acquirePooledDatabase, closePooledDatabases } from "./testing/reuse.js";
import { computeTemplateName, getTemplateDir, readStoredTemplate, storeTemplate } from "./testing/template-store.js";
import { guardPoolInsideTransaction } from "./testing/transaction-guard.js";

export {
  DEFAULT_DATABASE_OPENERS,
  expectEntriesOpenDatabase,
  findEntriesReachingDatabase,
  type EntryGuardOptions,
  type EntryReach,
} from "./entry-guard.js";
export { TEMPLATE_DIR_VARIABLE } from "./testing/template-store.js";
export { PoolInsideTransactionError } from "./testing/transaction-guard.js";

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
  /**
   * Names what the app hooks migrate, for the run-wide template folder of the global setup. Needed only for a hook
   * other than `drizzleAppMigrations` (whose files are read); without it such a template is kept per test file.
   * Change it when those migrations change, e.g. include a version.
   */
  readonly templateKey?: string;
  /**
   * `true`: a database a test closed is reset to the template and handed out again (a few milliseconds instead of a
   * new copy). Rows, sequences and session state are reset; a test that changes the schema gets a fresh copy next
   * time. Two open databases never share an instance.
   */
  readonly reuse?: boolean;
}

const templates = new Map<string, Promise<Blob | File>>();
const hookIds = new WeakMap<AppMigrationHook, number>();
let nextHookId = 1;

/**
 * A fresh, migrated, in-memory database per call. List the module under test and the modules it
 * depends on. Throws when a migration (a module file or an app hook) fails: that is a bug in the
 * module package or the app's migrations. A query on `db` or `client` from inside one of the
 * database's open transactions rejects with `PoolInsideTransactionError` instead of hanging.
 */
export async function createTestDatabase(modules: readonly AnySoftureModule[] = [], options: CreateTestDatabaseOptions = {}): Promise<TestDatabase> {
  const app = options.app ?? {};
  const key = computeTemplateKey(modules, app, options.templateKey);
  const openCopy = async (): Promise<TestDatabase> => {
    const client = new PGlite({ loadDataDir: await getTemplate(key, modules, app, options.templateKey) });
    guardPoolInsideTransaction(client);
    const handle = await createPgliteHandle(client);
    return { db: handle.db, client, close: handle.close };
  };
  return options.reuse === true ? acquirePooledDatabase(key, openCopy) : openCopy();
}

/** Closes the idle databases `reuse` keeps, so a test file can free them in `afterAll`. */
export function closeReusedTestDatabases(): Promise<void> {
  return closePooledDatabases();
}

function computeTemplateKey(modules: readonly AnySoftureModule[], app: AppMigrations, templateKey: string | undefined): string {
  const moduleKey = modules.map((module) => `${module.id}@${module.migrations?.dir.href ?? "-"}`).join("|");
  const baselineKey = Object.entries(app.baseline ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([id, through]) => `${id}:${through}`).join(",");
  return `${moduleKey}#before:${identifyHook(app.before)}#after:${identifyHook(app.after)}#baseline:${baselineKey}#key:${templateKey ?? "-"}`;
}

function getTemplate(key: string, modules: readonly AnySoftureModule[], app: AppMigrations, templateKey: string | undefined): Promise<Blob | File> {
  let template = templates.get(key);
  if (template === undefined) {
    template = loadOrBuildTemplate(modules, app, templateKey);
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

// From the run's folder when another file already built it; otherwise built here and stored for the others.
async function loadOrBuildTemplate(modules: readonly AnySoftureModule[], app: AppMigrations, templateKey: string | undefined): Promise<Blob | File> {
  const dir = getTemplateDir();
  const name = dir === null ? null : await computeTemplateName({ modules, app, templateKey });
  if (dir === null || name === null) {
    return buildTemplate(modules, app);
  }
  const stored = await readStoredTemplate(dir, name);
  if (stored !== null) {
    return stored;
  }
  const built = await buildTemplate(modules, app);
  await storeTemplate(dir, name, built);
  return built;
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
