// The reference schema for adoption: what a module's files 1..N create, built on a scratch
// in-memory PGlite together with the modules it depends on (directly or not), because its SQL may
// reference them. `adoptModule` and a baseline in `migrate` compare a live schema with it. Module
// SQL may also reference the app's own tables; their stubs, copied from the live database
// (`stubs.ts`), are created first (issue #170).
import { ok, type AnySoftureModule } from "@softure-ai/core";
import { createDatabase } from "../client.js";
import { applyFile, type MigrationUnit } from "./apply.js";
import { describeSchema } from "./introspect.js";
import { LEDGER_MODULE_ID, LEDGER_SCHEMA } from "./ledger.js";
import { failWith, type MigrationProblem, type MigrationResult } from "./problems.js";
import { withSession } from "./session.js";
import { createAppStubs, type AppCatalog } from "./stubs.js";

// drizzle's ledger schema (`drizzle.__drizzle_migrations`): never an app table a module references.
const APP_MIGRATOR_SCHEMA = "drizzle";

export interface ReferenceInput {
  /** The enabled modules, for the dependency graph. */
  readonly modules: readonly AnySoftureModule[];
  /** Their prepared units (`prepareUnits`), the ledger first, in dependency order. */
  readonly units: readonly MigrationUnit[];
  /** The module whose schema is described. */
  readonly target: MigrationUnit;
  /** The last file of the target to run; its dependencies run in full. */
  readonly through: number;
  /** Stubs of the app's tables (`readAppTables`), created before any file runs. */
  readonly appTables?: AppCatalog;
}

/** Every line `describeSchema` prints for the target's schema after its files 1..through. */
export async function buildReferenceSchema(input: ReferenceInput): Promise<MigrationResult<string[]>> {
  const included = collectWithDependencies(input.modules, input.target.module);
  const units = input.units
    .filter((unit) => unit.module === LEDGER_MODULE_ID || included.has(unit.module))
    .map((unit) => (unit.module === input.target.module ? { ...unit, files: unit.files.filter((file) => file.version <= input.through) } : unit));
  const scratch = await createDatabase("pglite://");
  try {
    return await withSession(scratch, async (session) => {
      const skipped = input.appTables === undefined ? [] : await createAppStubs(session, input.appTables);
      for (const unit of units) {
        for (const file of unit.files) {
          const failure = await applyFile(session, { unit, file, method: "applied" });
          if (failure !== null) {
            const reason = describeFailure(failure) + (skipped.length > 0 ? ` (app table stubs skipped: ${skipped.join("; ")})` : "");
            return failWith([{ code: "db.adopt_reference_failed", module: input.target.module, reason }]);
          }
        }
      }
      return ok(await describeSchema(session, input.target.schema));
    });
  } finally {
    await scratch.close();
  }
}

/** The schemas the migrator owns, which hold no app table: the ledger's, every unit's and drizzle's. */
export function listOwnedSchemas(units: readonly MigrationUnit[]): string[] {
  return [...new Set([LEDGER_SCHEMA, APP_MIGRATOR_SCHEMA, ...units.map((unit) => unit.schema)])];
}

/** The ids of the target and every enabled module it depends on, directly or not. */
export function collectWithDependencies(modules: readonly AnySoftureModule[], target: string): Set<string> {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const collected = new Set<string>();
  const visit = (id: string): void => {
    const module = byId.get(id);
    if (module === undefined || collected.has(id)) return;
    collected.add(id);
    for (const dependency of Object.keys(module.manifest.dependsOn)) visit(dependency);
  };
  visit(target);
  return collected;
}

function describeFailure(problem: MigrationProblem): string {
  return problem.code === "db.migration_failed" ? `${problem.module} ${problem.name}: ${problem.reason}` : problem.code;
}
