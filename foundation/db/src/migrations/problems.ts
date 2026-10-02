// Every expected migration failure, as a value (AGENTS.md: expected failures are results). Each
// problem names the module and file it is about; `describeProblem` turns it into the English line
// the CLI prints and `createTestDatabase` throws.
import type { Err, Ok } from "@softure-ai/core";

export type MigrationProblem =
  | { readonly code: "db.invalid_migration_file"; readonly module: string; readonly file: string; readonly reason: string }
  | { readonly code: "db.migrations_unreadable"; readonly module: string; readonly dir: string; readonly reason: string }
  | { readonly code: "db.migration_changed"; readonly module: string; readonly version: number; readonly name: string }
  | { readonly code: "db.migration_missing"; readonly module: string; readonly version: number; readonly name: string }
  | { readonly code: "db.migration_out_of_order"; readonly module: string; readonly version: number; readonly appliedVersion: number }
  | { readonly code: "db.migration_failed"; readonly module: string; readonly version: number; readonly name: string; readonly reason: string }
  | { readonly code: "db.reserved_module"; readonly module: string }
  | { readonly code: "db.migrations_without_schema"; readonly module: string }
  | { readonly code: "db.dependency_cycle"; readonly modules: readonly string[] }
  | { readonly code: "db.adopt_unknown_module"; readonly module: string }
  | { readonly code: "db.adopt_version_mismatch"; readonly module: string; readonly requested: string; readonly enabled: string }
  | { readonly code: "db.adopt_already_applied"; readonly module: string }
  | { readonly code: "db.adopt_dependency_pending"; readonly module: string; readonly dependency: string }
  | { readonly code: "db.adopt_no_schema"; readonly module: string }
  | { readonly code: "db.adopt_reference_failed"; readonly module: string; readonly reason: string }
  | { readonly code: "db.export_target_not_empty"; readonly module: string; readonly dir: string; readonly entries: readonly string[] }
  | { readonly code: "db.schema_mismatch"; readonly module: string; readonly schema: string; readonly differences: readonly string[] };

export type MigrationErrorCode = MigrationProblem["code"];

/** A failed migration operation: the code of its first problem, and every problem found. */
export interface MigrationFailure extends Err<MigrationErrorCode> {
  readonly problems: readonly MigrationProblem[];
}

export type MigrationResult<T> = Ok<T> | MigrationFailure;

export function failWith(problems: readonly MigrationProblem[]): MigrationFailure {
  const [first] = problems;
  if (first === undefined) {
    throw new Error("failWith: a migration failure needs at least one problem");
  }
  return { ok: false, error: first.code, problems };
}

/** One English line per problem, naming the module and the file or object involved. */
export function describeProblem(problem: MigrationProblem): string {
  switch (problem.code) {
    case "db.invalid_migration_file":
      return `${problem.module}: migration file ${problem.file} is invalid: ${problem.reason}`;
    case "db.migrations_unreadable":
      return `${problem.module}: cannot read the migrations folder ${problem.dir}: ${problem.reason}`;
    case "db.migration_changed":
      return `${problem.module}: applied migration ${formatFile(problem.version, problem.name)} was edited (checksum differs); add a new migration instead`;
    case "db.migration_missing":
      return `${problem.module}: applied migration ${formatFile(problem.version, problem.name)} is missing from the module`;
    case "db.migration_out_of_order":
      return `${problem.module}: migration ${formatVersion(problem.version)} is pending but ${formatVersion(problem.appliedVersion)} is already applied`;
    case "db.migration_failed":
      return `${problem.module}: migration ${formatFile(problem.version, problem.name)} failed and was rolled back: ${problem.reason}`;
    case "db.reserved_module":
      return `${problem.module}: uses a reserved id or schema (the id "softure"; the schemas softure, public, information_schema, pg_* and names over 63 bytes)`;
    case "db.migrations_without_schema":
      return `${problem.module}: has migrations but no dbSchema in its manifest`;
    case "db.dependency_cycle":
      return `modules ${problem.modules.join(", ")} depend on each other in a cycle`;
    case "db.adopt_unknown_module":
      return `${problem.module}: cannot adopt a module that is not enabled in the config`;
    case "db.adopt_version_mismatch":
      return `${problem.module}: --adopt asks for ${problem.requested} but ${problem.enabled} is enabled`;
    case "db.adopt_already_applied":
      return `${problem.module}: already has migrations in the ledger; adopt only works on a module the ledger has never seen`;
    case "db.adopt_dependency_pending":
      return `${problem.module}: depends on ${problem.dependency}, which has migrations still pending; migrate or adopt ${problem.dependency} first`;
    case "db.adopt_no_schema":
      return `${problem.module}: has no dbSchema, so there is nothing to adopt`;
    case "db.adopt_reference_failed":
      return `${problem.module}: could not build the reference schema: ${problem.reason}`;
    case "db.export_target_not_empty":
      return `${problem.module}: ${problem.dir} holds other files (${problem.entries.join(", ")}); export into an empty folder`;
    case "db.schema_mismatch":
      return [
        `${problem.module}: schema "${problem.schema}" differs from what its migrations create:`,
        ...problem.differences.map((difference) => `  ${difference}`),
      ].join("\n");
  }
}

function formatVersion(version: number): string {
  return String(version).padStart(4, "0");
}

function formatFile(version: number, name: string): string {
  return `${formatVersion(version)}_${name}.sql`;
}
