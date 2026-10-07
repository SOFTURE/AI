// Server-only API of @softure-ai/ops: the health check runner. It reads no request scope; the
// route in `@softure-ai/ops/next` passes the config and the database in.
export {
  collectHealthChecks,
  createDatabaseCheck,
  createMissingDatabaseCheck,
  DATABASE_CHECK_NAME,
  runHealthChecks,
  type NamedHealthCheck,
  type RunHealthChecksOptions,
} from "./health.js";
