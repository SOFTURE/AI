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
export { computeChecksum, readMigrationFiles, type MigrationFile } from "./migrations/files.js";
export {
  describeProblem,
  type MigrationErrorCode,
  type MigrationFailure,
  type MigrationProblem,
  type MigrationResult,
} from "./migrations/problems.js";
