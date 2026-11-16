// `@softure-ai/db/request`: the part of the package a Cloudflare Worker may import (docs/07-runtime-providers.md).
// It reaches no filesystem: migrations, exports and the CLI stay in the root entry and run under Node, in CI.
export {
  createDatabase,
  createPostgresHandle,
  isDatabaseHandle,
  type CreateDatabaseOptions,
  type Database,
  type DatabaseHandle,
  type DatabaseSchema,
  type PostgresDatabase,
  type Queryable,
  type QueryableResult,
} from "./client.js";
export { getConfiguredDatabase } from "./configured.js";
export { findDriverError, isConstraintViolation, type ConstraintViolation, type DriverError } from "./driver-errors.js";
export { getRequestDatabase, isWorkersRuntime, withRequestDatabase, type RequestDatabaseOptions } from "./request.js";
