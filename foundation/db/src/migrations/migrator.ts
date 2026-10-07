// The module migrator (docs/02-module-standard.md §4). Every enabled module's SQL files run in the
// module's own schema, dependencies first, one transaction per file together with its ledger row.
// Everything that can be checked (names, numbering, checksums, order) is checked for all modules
// before the first file runs, so a problem in one module never leaves another half-migrated.
// The app's own migrations (drizzle's, usually) plug in through `app.before` / `app.after`, and
// `app.baseline` names the module files the app's own history already creates (issue #152).
import { ok, sortModulesByDependencies, type AnySoftureModule } from "@softure-ai/core";
import type { DatabaseHandle } from "../client.js";
import { applyFile, describeError, recordAdoption, withMigrationLock, type MigrationUnit } from "./apply.js";
import { readMigrationFiles } from "./files.js";
import { describeSchema, diffSchemas } from "./introspect.js";
import { LEDGER_FILES, LEDGER_MODULE_ID, LEDGER_SCHEMA, LEDGER_VERSION, readJournal, type JournalRow } from "./ledger.js";
import { failWith, type MigrationProblem, type MigrationResult } from "./problems.js";
import { buildReferenceSchema } from "./reference.js";
import { withSession, type MigrationSession } from "./session.js";

export { applyFile, recordAdoption, rollBack, withMigrationLock, type MigrationUnit } from "./apply.js";

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
  /** Called after each file a baseline recorded as adopted, e.g. to print progress. */
  readonly onAdopted?: (step: MigrationStep) => void;
  /**
   * The app's own migrations around the module files, and its baseline. `planMigrations` runs no
   * hook; it reads only the baseline.
   */
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
  /**
   * The module files the app's own history already creates: module id → the last such file (1..n).
   * For a listed module the ledger has never seen, `migrate` compares the module's schema with
   * files 1..n once `before` ran and records them as `adopted`, then applies the later files; an
   * empty schema is migrated normally. Once the module is in the ledger the entry has no effect.
   */
  readonly baseline?: Readonly<Record<string, number>>;
}

export type AppMigrationPhase = "before" | "after";

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
  /**
   * The pending steps a baseline may adopt instead of applying: they are adopted when the module's
   * schema already holds objects after `before` (which a plan does not run).
   */
  readonly baseline: readonly MigrationStep[];
}

export interface MigrationReport {
  readonly applied: readonly MigrationStep[];
  /** The files a baseline recorded as adopted, in order. */
  readonly adopted: readonly MigrationStep[];
  /** The app hooks that ran, in order. */
  readonly app: readonly AppMigrationPhase[];
}

// `drizzle` holds drizzle's own ledger (`drizzle.__drizzle_migrations`) in every app on this stack.
const RESERVED_SCHEMAS = new Set([LEDGER_SCHEMA, "public", "information_schema", "drizzle"]);
const MAX_IDENTIFIER_BYTES = 63;

/** The dry run: what `migrate` would apply. Takes no lock and writes nothing. */
export async function planMigrations(handle: DatabaseHandle, options: MigrateOptions): Promise<MigrationResult<MigrationPlan>> {
  const units = await prepareUnits(options.modules, options.migrationsDir);
  if (!units.ok) {
    return units;
  }
  const baseline = options.app?.baseline ?? {};
  const baselineProblems = checkBaseline(options.modules, units.value, baseline);
  if (baselineProblems.length > 0) {
    return failWith(baselineProblems);
  }
  const journal = await withSession(handle, readJournal);
  const comparison = compareJournal(units.value, journal);
  if (comparison.problems.length > 0) {
    return failWith(comparison.problems);
  }
  const adoptable = comparison.pending.filter((step) => isBaselineStep(step, baseline, journal));
  return ok({ pending: comparison.pending, baseline: adoptable });
}

/**
 * Applies every pending migration under the advisory lock: the ledger, `app.before`, the module
 * files (adopting a baseline where it applies), then `app.after`. Nothing runs when a check fails.
 */
export async function migrate(handle: DatabaseHandle, options: MigrateOptions): Promise<MigrationResult<MigrationReport>> {
  const units = await prepareUnits(options.modules, options.migrationsDir);
  if (!units.ok) {
    return units;
  }
  const app = options.app ?? {};
  const baseline = app.baseline ?? {};
  const baselineProblems = checkBaseline(options.modules, units.value, baseline);
  if (baselineProblems.length > 0) {
    return failWith(baselineProblems);
  }
  return withSession(handle, (session) =>
    withMigrationLock(session, async () => {
      // Read after the lock: a runner that waited sees what the first one applied.
      const journal = await readJournal(session);
      const comparison = compareJournal(units.value, journal);
      if (comparison.problems.length > 0) {
        return failWith(comparison.problems);
      }
      const applied: MigrationStep[] = [];
      const adopted: MigrationStep[] = [];
      const ranHooks: AppMigrationPhase[] = [];
      const applySteps = async (steps: readonly MigrationStep[]): Promise<MigrationProblem | null> => {
        for (const step of steps) {
          const { unit, file } = findFile(units.value, step);
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
      // Unit by unit in dependency order, so a module's dependencies are migrated before its
      // baseline is compared.
      const migrateModules = async (): Promise<MigrationProblem | null> => {
        for (const unit of units.value) {
          if (unit.module === LEDGER_MODULE_ID) continue;
          const steps = comparison.pending.filter((step) => step.module === unit.module);
          const through = baseline[unit.module];
          if (through === undefined || journal.some((row) => row.module === unit.module)) {
            const failure = await applySteps(steps);
            if (failure !== null) return failure;
            continue;
          }
          const adoption = await adoptBaseline(session, { modules: options.modules, units: units.value, unit, through });
          if (adoption.problem !== null) return adoption.problem;
          for (const step of adoption.adopted) {
            adopted.push(step);
            options.onAdopted?.(step);
          }
          const failure = await applySteps(steps.filter((step) => !adoption.adopted.some((done) => done.version === step.version)));
          if (failure !== null) return failure;
        }
        return null;
      };

      // The ledger first, so it exists whatever a hook does; then before, the modules, after.
      const ledgerSteps = comparison.pending.filter((step) => step.module === LEDGER_MODULE_ID);
      const failure = (await applySteps(ledgerSteps)) ?? (await runHook("before")) ?? (await migrateModules()) ?? (await runHook("after"));
      if (failure !== null) {
        return failWith([failure]);
      }
      return ok({ applied, adopted, app: ranHooks });
    }),
  );
}

/**
 * Adopt-or-migrate for a baseline module the ledger has never seen: an empty schema adopts
 * nothing (its files are then applied normally); otherwise the schema must equal files 1..through,
 * which are then recorded as adopted in one transaction.
 */
async function adoptBaseline(
  session: MigrationSession,
  input: { modules: readonly AnySoftureModule[]; units: readonly MigrationUnit[]; unit: MigrationUnit; through: number },
): Promise<{ adopted: MigrationStep[]; problem: MigrationProblem | null }> {
  const { unit, through } = input;
  const live = await describeSchema(session, unit.schema);
  if (live.length === 0) {
    return { adopted: [], problem: null };
  }
  // Built only here, so a database whose modules are all in the ledger never needs PGlite.
  const reference = await buildReferenceSchema({ modules: input.modules, units: input.units, target: unit, through });
  if (!reference.ok) {
    return { adopted: [], problem: reference.problems[0] ?? null };
  }
  const differences = diffSchemas(reference.value, live);
  if (differences.length > 0) {
    return { adopted: [], problem: { code: "db.schema_mismatch", module: unit.module, schema: unit.schema, differences } };
  }
  const files = unit.files.filter((file) => file.version <= through);
  const failure = await recordAdoption(session, unit, files);
  if (failure !== null) {
    return { adopted: [], problem: failure };
  }
  return { adopted: files.map((file) => toStep(unit, file)), problem: null };
}

/**
 * A baseline may name only enabled modules with a schema and migrations, and a last file between
 * 1 and the module's file count. Checked before anything runs.
 */
function checkBaseline(
  modules: readonly AnySoftureModule[],
  units: readonly MigrationUnit[],
  baseline: Readonly<Record<string, number>>,
): MigrationProblem[] {
  return Object.entries(baseline).flatMap(([module, through]): MigrationProblem[] => {
    if (!modules.some((candidate) => candidate.id === module)) {
      return [{ code: "db.adopt_unknown_module", module }];
    }
    const unit = units.find((candidate) => candidate.module === module);
    if (unit === undefined) {
      return [{ code: "db.adopt_no_schema", module }];
    }
    return checkThrough(unit, through);
  });
}

/** `through` must be a whole number from 1 to the unit's file count. */
export function checkThrough(unit: MigrationUnit, through: number): MigrationProblem[] {
  const files = unit.files.length;
  return Number.isInteger(through) && through >= 1 && through <= files
    ? []
    : [{ code: "db.adopt_through_out_of_range", module: unit.module, through, files }];
}

function isBaselineStep(step: MigrationStep, baseline: Readonly<Record<string, number>>, journal: readonly JournalRow[]): boolean {
  const through = baseline[step.module];
  return through !== undefined && step.version <= through && !journal.some((row) => row.module === step.module);
}

function findFile(units: readonly MigrationUnit[], step: MigrationStep): { unit: MigrationUnit; file: MigrationUnit["files"][number] } {
  const unit = units.find((candidate) => candidate.module === step.module);
  const file = unit?.files.find((candidate) => candidate.version === step.version);
  if (unit === undefined || file === undefined) {
    throw new Error(`migrate: step ${step.module} ${step.version} has no file; compareJournal is broken`);
  }
  return { unit, file };
}

export function toStep(unit: MigrationUnit, file: MigrationUnit["files"][number]): MigrationStep {
  return { module: unit.module, schema: unit.schema, version: file.version, name: file.name, checksum: file.checksum };
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

function ensureFolderUrl(url: URL): URL {
  return url.href.endsWith("/") ? url : new URL(`${url.href}/`);
}
