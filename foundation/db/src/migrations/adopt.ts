// Adoption (docs/02-module-standard.md §4, docs/05-adoption-playbook.md step 3): an existing app
// has moved its own tables into a module's schema with its own migration. `adoptModule` checks
// that the schema now equals what the module's migrations would create, then records those
// migrations as `adopted` without running them. Any difference refuses: marking a schema as
// migrated when it is not is the one mistake a later migration cannot recover from.
import { ok, type AnySoftureModule } from "@softure-ai/core";
import { createDatabase, type DatabaseHandle } from "../client.js";
import { describeSchema, diffSchemas } from "./introspect.js";
import { LEDGER_MODULE_ID, readJournal, recordMigration, type JournalRow } from "./ledger.js";
import {
  applyFile,
  compareJournal,
  migrate,
  prepareUnits,
  rollBack,
  withMigrationLock,
  type MigrationStep,
  type MigrationUnit,
} from "./migrator.js";
import { failWith, type MigrationProblem, type MigrationResult } from "./problems.js";
import { withSession, type MigrationSession } from "./session.js";

export interface AdoptOptions {
  /** The enabled modules, as for `migrate`. */
  readonly modules: readonly AnySoftureModule[];
  /** The id of the module to adopt. */
  readonly module: string;
  /** Its version; must equal the enabled module's manifest version. */
  readonly version: string;
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

  const reference = await describeReference(options, target);
  if (!reference.ok) {
    return reference;
  }

  return withSession(handle, (session) =>
    withMigrationLock(session, async () => {
      const journal = await readJournal(session);
      const comparison = compareJournal(units.value, journal);
      const problems = [...comparison.problems, ...checkAdoptable(target, unit, journal, comparison.pending)];
      if (problems.length > 0) {
        return failWith(problems);
      }
      const differences = diffSchemas(reference.value, await describeSchema(session, unit.schema));
      if (differences.length > 0) {
        return failWith([{ code: "db.schema_mismatch", module: unit.module, schema: unit.schema, differences }]);
      }

      const ledger = comparison.pending.filter((step) => step.module === LEDGER_MODULE_ID);
      const adopted = unit.files.map((file) => ({ module: unit.module, schema: unit.schema, version: file.version, name: file.name, checksum: file.checksum }));
      const report = { module: unit.module, version: options.version, dryRun: options.dryRun === true, ledger, adopted };
      if (options.dryRun === true) {
        return ok(report);
      }
      const failure = await writeAdoption(session, units.value, unit);
      return failure === null ? ok(report) : failWith([failure]);
    }),
  );
}

/** The adopted module must be new to the ledger, and everything it depends on fully migrated. */
function checkAdoptable(
  target: AnySoftureModule,
  unit: MigrationUnit,
  journal: readonly JournalRow[],
  pending: readonly MigrationStep[],
): MigrationProblem[] {
  if (journal.some((row) => row.module === unit.module)) {
    return [{ code: "db.adopt_already_applied", module: unit.module }];
  }
  return Object.keys(target.manifest.dependsOn)
    .filter((dependency) => pending.some((step) => step.module === dependency))
    .map((dependency) => ({ code: "db.adopt_dependency_pending", module: unit.module, dependency }));
}

/**
 * The schema the module's migrations create: they run on a scratch PGlite together with the
 * enabled modules the target depends on (directly or not), because its SQL may reference them.
 */
async function describeReference(options: AdoptOptions, target: AnySoftureModule): Promise<MigrationResult<string[]>> {
  const modules = collectWithDependencies(options.modules, target);
  const scratch = await createDatabase("pglite://");
  try {
    const result = await migrate(scratch, { modules, ...(options.migrationsDir ? { migrationsDir: options.migrationsDir } : {}) });
    if (!result.ok) {
      const reason = result.problems.map((problem) => problem.code === "db.migration_failed" ? `${problem.module} ${problem.name}: ${problem.reason}` : problem.code).join("; ");
      return failWith([{ code: "db.adopt_reference_failed", module: target.id, reason }]);
    }
    const schema = target.manifest.dbSchema ?? "";
    return ok(await withSession(scratch, (session) => describeSchema(session, schema)));
  } finally {
    await scratch.close();
  }
}

function collectWithDependencies(modules: readonly AnySoftureModule[], target: AnySoftureModule): AnySoftureModule[] {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const collected = new Map<string, AnySoftureModule>();
  const visit = (module: AnySoftureModule): void => {
    if (collected.has(module.id)) return;
    collected.set(module.id, module);
    for (const dependency of Object.keys(module.manifest.dependsOn)) {
      const listed = byId.get(dependency);
      if (listed !== undefined) visit(listed);
    }
  };
  visit(target);
  return [...collected.values()];
}

/** Applies a pending ledger migration, then records every module file as adopted in one transaction. */
async function writeAdoption(session: MigrationSession, units: readonly MigrationUnit[], unit: MigrationUnit): Promise<MigrationProblem | null> {
  const ledger = units.find((candidate) => candidate.module === LEDGER_MODULE_ID);
  const journal = await readJournal(session);
  for (const file of ledger?.files ?? []) {
    if (ledger !== undefined && !journal.some((row) => row.module === LEDGER_MODULE_ID && row.version === file.version)) {
      const failure = await applyFile(session, { unit: ledger, file, method: "applied" });
      if (failure !== null) return failure;
    }
  }
  try {
    await session.exec("BEGIN");
    for (const file of unit.files) {
      await recordMigration(session, {
        module: unit.module,
        version: file.version,
        name: file.name,
        checksum: file.checksum,
        moduleVersion: unit.moduleVersion,
        method: "adopted",
      });
    }
    await session.exec("COMMIT");
    return null;
  } catch (error) {
    const reason = await rollBack(session, error);
    const first = unit.files[0];
    return { code: "db.migration_failed", module: unit.module, version: first?.version ?? 0, name: first?.name ?? "", reason };
  }
}
