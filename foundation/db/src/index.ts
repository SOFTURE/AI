// Public API of @softure-ai/db: the database client and the module migrator
// (docs/02-module-standard.md §4). Test databases: `@softure-ai/db/testing`; CLI: `@softure-ai/db/cli`.
export {
  createDatabase,
  type CreateDatabaseOptions,
  type Database,
  type DatabaseHandle,
  type PgliteClientDatabase,
  type PostgresDatabase,
  type Queryable,
} from "./client.js";
export { closeSharedDatabases, getSharedDatabase } from "./shared.js";
export { computeChecksum, readMigrationFiles, type MigrationFile } from "./migrations/files.js";
export {
  describeProblem,
  type MigrationErrorCode,
  type MigrationFailure,
  type MigrationProblem,
  type MigrationResult,
} from "./migrations/problems.js";
export {
  migrate,
  planMigrations,
  type MigrateOptions,
  type MigrationPlan,
  type MigrationReport,
  type MigrationStep,
} from "./migrations/migrator.js";
export { adoptModule, type AdoptionReport, type AdoptOptions } from "./migrations/adopt.js";
export { exportMigrations } from "./migrations/export.js";
export {
  checkExportedMigrations,
  type ExportedMigration,
  type ExportedMigrationsCheck,
} from "./migrations/exported.js";
export { readJournal, type JournalRow, type MigrationMethod } from "./migrations/ledger.js";
export type { MigrationSession } from "./migrations/session.js";
