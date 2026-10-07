// Adoption (docs/02-module-standard.md §4, docs/05-adoption-playbook.md step 3): an existing app
// has moved its own tables into a module's schema with its own migration. `adoptModule` checks
// that the schema now equals what the module's files 1..through would create, then records those
// files as `adopted` without running them; the later files stay pending for `migrate`. Any
// difference refuses: marking a schema as migrated when it is not is the one mistake a later
// migration cannot recover from. The pending files of the modules it depends on run first.
import { ok, type AnySoftureModule } from "@softure-ai/core";
import type { DatabaseHandle } from "../client.js";
import { applyFile, recordAdoption, withMigrationLock, type MigrationUnit } from "./apply.js";
import { describeSchema, diffSchemas } from "./introspect.js";
import { LEDGER_MODULE_ID, readJournal, type JournalRow } from "./ledger.js";
import { checkThrough, compareJournal, prepareUnits, toStep, type MigrationStep } from "./migrator.js";
import { failWith, type MigrationProblem, type MigrationResult } from "./problems.js";
import { buildReferenceSchema, collectWithDependencies, listOwnedSchemas } from "./reference.js";
import { withSession, type MigrationSession } from "./session.js";
import { readAppTables } from "./stubs.js";

export interface AdoptOptions {
  /** The enabled modules, as for `migrate`. */
  readonly modules: readonly AnySoftureModule[];
  /** The id of the module to adopt. */
  readonly module: string;
  /** Its version; must equal the enabled module's manifest version. */
  readonly version: string;
  /**
   * The last file to adopt (1..n); default every file. The later files stay pending and the next
   * `migrate` applies them.
   */
  readonly through?: number;
  /** Compare and report only; write nothing (also no ledger). */
  readonly dryRun?: boolean;
  readonly migrationsDir?: URL;
}

export interface AdoptionReport {
  readonly module: string;
  readonly version: string;
  readonly dryRun: boolean;
  /** Ledger migrations applied first (or that would be, on a dry run). */
  readonly ledger: readonly MigrationStep[];
  /** Pending files of the modules it depends on, applied before the comparison (or that would be). */
  readonly dependencies: readonly MigrationStep[];
  /** The module's migrations recorded as adopted (or that would be). */
  readonly adopted: readonly MigrationStep[];
}

export async function adoptModule(handle: DatabaseHandle, options: AdoptOptions): Promise<MigrationResult<AdoptionReport>> {
  const target = options.modules.find((module) => module.id === options.module);
  if (target === undefined) {
    return failWith([{ code: "db.adopt_unknown_module", module: options.module }]);
  }
  if (target.manifest.version !== options.version) {
    return failWith([{ code: "db.adopt_version_mismatch", module: target.id, requested: options.version, enabled: target.manifest.version }]);
  }
  const units = await prepareUnits(options.modules, options.migrationsDir);
  if (!units.ok) {
    return units;
  }
  const unit = units.value.find((candidate) => candidate.module === target.id);
  if (unit === undefined) {
    return failWith([{ code: "db.adopt_no_schema", module: target.id }]);
  }
  const through = options.through ?? unit.files.length;
  const throughProblems = checkThrough(unit, through);
  if (throughProblems.length > 0) {
    return failWith(throughProblems);
  }

  return withSession(handle, (session) =>
    withMigrationLock(session, async () => {
      const journal = await readJournal(session);
      const comparison = compareJournal(units.value, journal);
      const problems = [...comparison.problems, ...checkAdoptable(unit, journal)];
      if (problems.length > 0) {
        return failWith(problems);
      }
      const dependencyIds = collectWithDependencies(options.modules, target.id);
      dependencyIds.delete(target.id);
      const ledger = comparison.pending.filter((step) => step.module === LEDGER_MODULE_ID);
      const dependencies = comparison.pending.filter((step) => dependencyIds.has(step.module));
      const files = unit.files.filter((file) => file.version <= through);
      const adopted = files.map((file) => toStep(unit, file));
      const report = { module: unit.module, version: options.version, dryRun: options.dryRun === true, ledger, dependencies, adopted };

      // Built from the live database's app tables (module SQL may reference them, issue #170), so
      // inside the lock and only once the checks above passed.
      const appTables = await readAppTables(session, listOwnedSchemas(units.value));
      const reference = await buildReferenceSchema({ modules: options.modules, units: units.value, target: unit, through, appTables });
      if (!reference.ok) {
        return reference;
      }
      // The target's own schema only, compared before anything is written: applying a dependency
      // never changes it.
      const differences = diffSchemas(reference.value, await describeSchema(session, unit.schema));
      if (differences.length > 0) {
        return failWith([{ code: "db.schema_mismatch", module: unit.module, schema: unit.schema, differences }]);
      }
      if (options.dryRun === true) {
        return ok(report);
      }
      const ledgerFailure = await applyPending(session, units.value, ledger);
      if (ledgerFailure !== null) {
        return failWith([ledgerFailure.problem]);
      }
      const dependencyFailure = await applyPending(session, units.value, dependencies);
      if (dependencyFailure !== null) {
        return failWith([dependencyFailure.problem, { code: "db.adopt_dependency_pending", module: unit.module, dependency: dependencyFailure.step.module }]);
      }
      const failure = await recordAdoption(session, unit, files);
      return failure === null ? ok(report) : failWith([failure]);
    }),
  );
}

/** The adopted module must be new to the ledger. */
function checkAdoptable(unit: MigrationUnit, journal: readonly JournalRow[]): MigrationProblem[] {
  return journal.some((row) => row.module === unit.module) ? [{ code: "db.adopt_already_applied", module: unit.module }] : [];
}

/** Applies the steps in order, each file in its own transaction; stops at the first failure. */
async function applyPending(
  session: MigrationSession,
  units: readonly MigrationUnit[],
  steps: readonly MigrationStep[],
): Promise<{ problem: MigrationProblem; step: MigrationStep } | null> {
  for (const step of steps) {
    const unit = units.find((candidate) => candidate.module === step.module);
    const file = unit?.files.find((candidate) => candidate.version === step.version);
    if (unit === undefined || file === undefined) {
      throw new Error(`adoptModule: step ${step.module} ${step.version} has no file; compareJournal is broken`);
    }
    const failure = await applyFile(session, { unit, file, method: "applied" });
    if (failure !== null) return { problem: failure, step };
  }
  return null;
}
