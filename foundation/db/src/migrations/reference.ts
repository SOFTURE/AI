// The reference schema for adoption: what a module's files 1..N create, built on a scratch
// in-memory PGlite together with the modules it depends on (directly or not), because its SQL may
// reference them. `adoptModule` and a baseline in `migrate` compare a live schema with it.
import { ok, type AnySoftureModule } from "@softure-ai/core";
import { createDatabase } from "../client.js";
import { applyFile, type MigrationUnit } from "./apply.js";
import { describeSchema } from "./introspect.js";
import { LEDGER_MODULE_ID } from "./ledger.js";
import { failWith, type MigrationProblem, type MigrationResult } from "./problems.js";
import { withSession } from "./session.js";

export interface ReferenceInput {
  /** The enabled modules, for the dependency graph. */
  readonly modules: readonly AnySoftureModule[];
  /** Their prepared units (`prepareUnits`), the ledger first, in dependency order. */
  readonly units: readonly MigrationUnit[];
  /** The module whose schema is described. */
  readonly target: MigrationUnit;
  /** The last file of the target to run; its dependencies run in full. */
  readonly through: number;
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
      for (const unit of units) {
        for (const file of unit.files) {
          const failure = await applyFile(session, { unit, file, method: "applied" });
          if (failure !== null) {
            return failWith([{ code: "db.adopt_reference_failed", module: input.target.module, reason: describeFailure(failure) }]);
          }
        }
      }
      return ok(await describeSchema(session, input.target.schema));
    });
  } finally {
    await scratch.close();
  }
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
