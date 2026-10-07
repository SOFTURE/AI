// The module migrator (docs/02-module-standard.md §4). Every enabled module's SQL files run in the
// module's own schema, dependencies first, one transaction per file together with its ledger row.
// Everything that can be checked (names, numbering, checksums, order) is checked for all modules
// before the first file runs, so a problem in one module never leaves another half-migrated.
// The app's own migrations (drizzle's, usually) plug in through `app.before` / `app.after`.
import { ok, sortModulesByDependencies, type AnySoftureModule } from "@softure-ai/core";
import type { DatabaseHandle } from "../client.js";
import { readMigrationFiles, type MigrationFile } from "./files.js";
import {
  LEDGER_FILES,
  LEDGER_MODULE_ID,
  LEDGER_SCHEMA,
  LEDGER_VERSION,
  readJournal,
  recordMigration,
  type JournalRow,
  type MigrationMethod,
} from "./ledger.js";
import { failWith, type MigrationProblem, type MigrationResult } from "./problems.js";
import { withSession, type MigrationSession } from "./session.js";

export interface MigrateOptions {
  /** The enabled modules, in any order; dependencies are applied first. */
  readonly modules: readonly AnySoftureModule[];
  /**
   * Read each module's files from `<migrationsDir>/<module id>/` instead of the module's own
   * folder: the container path, where a bundle cannot locate package folders.
   */
  readonly migrationsDir?: URL;
  /** Called after each file is committed, e.g. to print progress. */
  readonly onApplied?: (step: MigrationStep) => void;
  /** The app's own migrations around the module files. `planMigrations` ignores them. */
  readonly app?: AppMigrations;
  /** Called after an app hook succeeded, e.g. to print progress. */
  readonly onAppMigrated?: (phase: AppMigrationPhase) => void;
}

/**
 * The app's own migration runner, called by `migrate` under the migration lock on every run (it
 * must skip what it already applied, as drizzle's migrator does). A throw or rejection is reported
 * as `db.app_migration_failed`.
 */
export type AppMigrationHook = (handle: DatabaseHandle) => Promise<void>;

export interface AppMigrations {
  /** Runs before the module files: app tables that module SQL references (normally the app's whole history). */
  readonly before?: AppMigrationHook;
  /** Runs after the module files: app migrations that reference tables a module creates. */
  readonly after?: AppMigrationHook;
}

export type AppMigrationPhase = keyof AppMigrations;

export interface MigrationStep {
  readonly module: string;
  readonly schema: string;
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

export interface MigrationPlan {
  /** What `migrate` would apply, in order. */
  readonly pending: readonly MigrationStep[];
}

export interface MigrationReport {
  readonly applied: readonly MigrationStep[];
  /** The app hooks that ran, in order. */
  readonly app: readonly AppMigrationPhase[];
}

/** One migration owner: the ledger itself or an enabled module with a schema. */
export interface MigrationUnit {
  readonly module: string;
  readonly schema: string;
  readonly moduleVersion: string;
  readonly files: readonly MigrationFile[];
}

// Any constant works; it only has to be the same for every runner of every app.
const MIGRATION_LOCK_KEY = "73012026";
// `drizzle` holds drizzle's own ledger (`drizzle.__drizzle_migrations`) in every app on this stack.
const RESERVED_SCHEMAS = new Set([LEDGER_SCHEMA, "public", "information_schema", "drizzle"]);
const MAX_IDENTIFIER_BYTES = 63;

/** The dry run: what `migrate` would apply. Takes no lock and writes nothing. */
export async function planMigrations(handle: DatabaseHandle, options: MigrateOptions): Promise<MigrationResult<MigrationPlan>> {
  const units = await prepareUnits(options.modules, options.migrationsDir);
  if (!units.ok) {
    return units;
  }
  const journal = await withSession(handle, readJournal);
  const comparison = compareJournal(units.value, journal);
  return comparison.problems.length > 0 ? failWith(comparison.problems) : ok({ pending: comparison.pending });
}

/**
 * Applies every pending migration under the advisory lock: the ledger, `app.before`, the module
 * files, then `app.after`. Nothing runs when a check fails.
 */
export async function migrate(handle: DatabaseHandle, options: MigrateOptions): Promise<MigrationResult<MigrationReport>> {
  const units = await prepareUnits(options.modules, options.migrationsDir);
  if (!units.ok) {
    return units;
  }
  const app = options.app ?? {};
  return withSession(handle, (session) =>
    withMigrationLock(session, async () => {
      // Read after the lock: a runner that waited sees what the first one applied.
      const comparison = compareJournal(units.value, await readJournal(session));
      if (comparison.problems.length > 0) {
        return failWith(comparison.problems);
      }
      // The ledger first, so it exists whatever a hook does; then before, the modules, after.
      const ledgerSteps = comparison.pending.filter((step) => step.module === LEDGER_MODULE_ID);
      const moduleSteps = comparison.pending.filter((step) => step.module !== LEDGER_MODULE_ID);
      const applied: MigrationStep[] = [];
      const ranHooks: AppMigrationPhase[] = [];
      const applySteps = async (steps: readonly MigrationStep[]): Promise<MigrationProblem | null> => {
        for (const step of steps) {
          const unit = units.value.find((candidate) => candidate.module === step.module);
          const file = unit?.files.find((candidate) => candidate.version === step.version);
          if (unit === undefined || file === undefined) {
            throw new Error(`migrate: step ${step.module} ${step.version} has no file; compareJournal is broken`);
          }
          const failure = await applyFile(session, { unit, file, method: "applied" });
          if (failure !== null) {
            return failure;
          }
          applied.push(step);
          options.onApplied?.(step);
        }
        return null;
      };
      const runHook = async (phase: AppMigrationPhase): Promise<MigrationProblem | null> => {
        const failure = await runAppHook(handle, app, phase);
        if (failure === null && app[phase] !== undefined) {
          ranHooks.push(phase);
          options.onAppMigrated?.(phase);
        }
        return failure;
      };

      const failure =
        (await applySteps(ledgerSteps)) ?? (await runHook("before")) ?? (await applySteps(moduleSteps)) ?? (await runHook("after"));
      if (failure !== null) {
        return failWith([failure]);
      }
      return ok({ applied, app: ranHooks });
    }),
  );
}

/**
 * Runs one app hook alone under the migration lock (the CLI's `--adopt` runs `before` first, so the
 * app migration that moves a table and the adoption are one command). Ok when there is no hook.
 */
export async function runAppMigrations(
  handle: DatabaseHandle,
  app: AppMigrations,
  phase: AppMigrationPhase,
): Promise<MigrationResult<{ ran: boolean }>> {
  if (app[phase] === undefined) {
    return ok({ ran: false });
  }
  const failure = await withSession(handle, (session) => withMigrationLock(session, () => runAppHook(handle, app, phase)));
  return failure === null ? ok({ ran: true }) : failWith([failure]);
}

async function runAppHook(handle: DatabaseHandle, app: AppMigrations, phase: AppMigrationPhase): Promise<MigrationProblem | null> {
  const hook = app[phase];
  if (hook === undefined) {
    return null;
  }
  try {
    await hook(handle);
    return null;
  } catch (error) {
    return { code: "db.app_migration_failed", phase, reason: describeErrorChain(error) };
  }
}

// drizzle wraps the database error (`Failed query: <sql>`, the Postgres message in `cause`), so the
// whole chain is the reason.
function describeErrorChain(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (current !== undefined && current !== null && messages.length < 5) {
    messages.push(describeError(current));
    current = current instanceof Error ? current.cause : undefined;
  }
  return messages.join(": ");
}

/**
 * Validates the module list and reads every file: the ledger first, then the modules with a
 * schema in dependency order. Fails with every problem found.
 */
export async function prepareUnits(
  modules: readonly AnySoftureModule[],
  migrationsDir: URL | undefined,
): Promise<MigrationResult<MigrationUnit[]>> {
  const problems = modules.flatMap(checkModule);
  const sorted = sortModulesByDependencies(modules);
  if (!sorted.ok) {
    problems.push({ code: "db.dependency_cycle", modules: modules.map((module) => module.id) });
  }
  if (problems.length > 0 || !sorted.ok) {
    return failWith(problems);
  }

  const units: MigrationUnit[] = [
    { module: LEDGER_MODULE_ID, schema: LEDGER_SCHEMA, moduleVersion: LEDGER_VERSION, files: LEDGER_FILES },
  ];
  for (const module of sorted.value) {
    const schema = module.manifest.dbSchema;
    if (schema === null || module.migrations === null) {
      continue;
    }
    const dir = migrationsDir === undefined ? module.migrations.dir : new URL(`${module.id}/`, ensureFolderUrl(migrationsDir));
    const files = await readMigrationFiles(module.id, dir);
    if (files.ok) {
      units.push({ module: module.id, schema, moduleVersion: module.manifest.version, files: files.value });
    } else {
      problems.push(...files.problems);
    }
  }
  return problems.length > 0 ? failWith(problems) : ok(units);
}

/** Checks applied files against the folder and lists the pending ones in run order. */
export function compareJournal(
  units: readonly MigrationUnit[],
  journal: readonly JournalRow[],
): { problems: MigrationProblem[]; pending: MigrationStep[] } {
  const problems: MigrationProblem[] = [];
  const pending: MigrationStep[] = [];
  for (const unit of units) {
    const rows = journal.filter((row) => row.module === unit.module);
    const appliedVersions = new Set(rows.map((row) => row.version));
    const lastApplied = Math.max(0, ...rows.map((row) => row.version));

    for (const row of rows) {
      const file = unit.files.find((candidate) => candidate.version === row.version);
      if (file === undefined) {
        problems.push({ code: "db.migration_missing", module: unit.module, version: row.version, name: row.name });
      } else if (file.checksum !== row.checksum || file.name !== row.name) {
        problems.push({ code: "db.migration_changed", module: unit.module, version: row.version, name: row.name });
      }
    }
    for (const file of unit.files) {
      if (appliedVersions.has(file.version)) {
        continue;
      }
      if (file.version < lastApplied) {
        problems.push({ code: "db.migration_out_of_order", module: unit.module, version: file.version, appliedVersion: lastApplied });
      } else {
        pending.push({ module: unit.module, schema: unit.schema, version: file.version, name: file.name, checksum: file.checksum });
      }
    }
  }
  return { problems, pending };
}

/**
 * Runs one file and its ledger row in one transaction, inside the unit's schema. Returns the
 * problem when the SQL fails; the transaction is rolled back first.
 */
export async function applyFile(
  session: MigrationSession,
  input: { unit: MigrationUnit; file: MigrationFile; method: MigrationMethod },
): Promise<MigrationProblem | null> {
  const { unit, file, method } = input;
  // The schema passed the manifest's lower_snake_case rule and checkModule; quoting is a second line.
  const schema = quoteIdentifier(unit.schema);
  try {
    await session.exec(`BEGIN; CREATE SCHEMA IF NOT EXISTS ${schema}; SET LOCAL search_path TO ${schema}, public;`);
    const transactionId = await readTransactionId(session);
    if (method === "applied") {
      await session.exec(file.sql);
    }
    // Second line behind findTransactionControl: a file that still ended the transaction left
    // part of itself committed, so it must not be reported as cleanly rolled back.
    if ((await readTransactionId(session)) !== transactionId) {
      throw new TransactionEndedError();
    }
    await recordMigration(session, {
      module: unit.module,
      version: file.version,
      name: file.name,
      checksum: file.checksum,
      moduleVersion: unit.moduleVersion,
      method,
    });
    await session.exec("COMMIT");
    return null;
  } catch (error) {
    const reason = await rollBack(session, error);
    return { code: "db.migration_failed", module: unit.module, version: file.version, name: file.name, reason };
  }
}

class TransactionEndedError extends Error {
  constructor() {
    super("the file ended the migrator's transaction, so the statements before that point may be committed; check the schema by hand");
  }
}

// The transaction id, not now(): two transactions can share a start time (PGlite's clock ticks in
// milliseconds), but never an id.
async function readTransactionId(session: MigrationSession): Promise<string> {
  const [row] = await session.query<{ id: string }>("SELECT pg_current_xact_id()::text AS id");
  return row?.id ?? "";
}

/**
 * Rolls the open transaction back and returns the reason to report. A failing ROLLBACK (a lost
 * connection) is added to the reason instead of hiding the original error.
 */
export async function rollBack(session: MigrationSession, error: unknown): Promise<string> {
  const reason = describeError(error);
  try {
    await session.exec("ROLLBACK");
    return reason;
  } catch (rollbackError) {
    return `${reason} (and ROLLBACK failed: ${describeError(rollbackError)})`;
  }
}

/** Holds the session-level advisory lock while `run` runs; a second runner waits for it. */
export async function withMigrationLock<T>(session: MigrationSession, run: () => Promise<T>): Promise<T> {
  await session.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  let result: T;
  try {
    result = await run();
  } catch (error) {
    // The run's own error wins; an unlock failure here is secondary (the session is discarded).
    await session.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch((unlockError: unknown) => {
      throw new Error(`migration run failed (${describeError(error)}) and releasing the lock failed: ${describeError(unlockError)}`, {
        cause: error,
      });
    });
    throw error;
  }
  await session.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
  return result;
}

function checkModule(module: AnySoftureModule): MigrationProblem[] {
  const schema = module.manifest.dbSchema;
  if (module.id === LEDGER_MODULE_ID || (schema !== null && isReservedSchema(schema))) {
    return [{ code: "db.reserved_module", module: module.id }];
  }
  if (schema === null && module.migrations !== null) {
    return [{ code: "db.migrations_without_schema", module: module.id }];
  }
  return [];
}

function isReservedSchema(schema: string): boolean {
  return RESERVED_SCHEMAS.has(schema) || schema.startsWith("pg_") || Buffer.byteLength(schema, "utf8") > MAX_IDENTIFIER_BYTES;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function ensureFolderUrl(url: URL): URL {
  return url.href.endsWith("/") ? url : new URL(`${url.href}/`);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
