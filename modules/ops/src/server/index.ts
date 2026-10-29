// Server-only API of @softure-ai/ops: the health check runner, the health answer and the build info. It reads no
// request scope and does not import Next; the route in `@softure-ai/ops/next` passes the config in.
export {
  createBuildInfoResponse,
  readBuildInfo,
  type BuildInfoAnswer,
  type BuildInfoOptions,
} from "./build-info.js";
export { closeHealthDatabases } from "./health-database.js";
export { createHealthResponse } from "./health-response.js";
export {
  collectHealthChecks,
  createDatabaseCheck,
  createMissingDatabaseCheck,
  DATABASE_CHECK_NAME,
  runHealthChecks,
  type NamedHealthCheck,
  type RunHealthChecksOptions,
} from "./health.js";
