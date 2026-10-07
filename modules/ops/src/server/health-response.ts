// What `GET /api/health` answers, without Next: the route in `@softure-ai/ops/next` is
// `connection()` plus this function, so an app can unit test the answer with a plain call.
//
// A public route without a session: the answer is `{ status }` and a code, 200 "will take traffic"
// or 503 "will not", and nothing else unless the app opts into `detail: "checks"`. Causes go to the
// server log only. It takes no input and costs one cheap query per check, so
// instead of a database-backed rate limit (which would make health depend on the database it
// reports on) concurrent requests share one run.
import { errorLogLabel, getModule, systemClock, type SoftureConfig, type SoftureDatabaseConfig } from "@softure-ai/core";
import { getConfiguredDatabase, type Queryable } from "@softure-ai/db";
import type { HealthReport } from "../contract.js";
import { MODULE_ID } from "../index.js";
import type { OpsOptions } from "../options.js";
import { getHealthDatabase } from "./health-database.js";
import { collectHealthChecks, DATABASE_CHECK_NAME, runHealthChecks } from "./health.js";

const PGLITE_PREFIX = "pglite://";

let inFlight: Promise<HealthReport> | null = null;

/**
 * The health answer for `config`: runs the checks and returns the `Response` the route sends.
 * Concurrent calls share one run of the checks whatever config each passes (one app has one config);
 * await each call when a test passes different configs. Throws when `ops()` is not in the config.
 */
export async function createHealthResponse(config: SoftureConfig): Promise<Response> {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("GET /api/health: the ops module is not enabled; add ops() to modules in softure.config.ts");
  }
  const options = module.options as OpsOptions;

  inFlight ??= checkHealth(config, options).finally(() => {
    inFlight = null;
  });
  const report = await inFlight;

  const body = options.detail === "checks" ? report : { status: report.status };
  return Response.json(body, {
    status: report.status === "ok" ? 200 : 503,
    // A cached "ok" is exactly the false green this route exists to prevent.
    headers: { "cache-control": "no-store" },
  });
}

async function checkHealth(config: SoftureConfig, options: OpsOptions): Promise<HealthReport> {
  let db: Queryable | null = null;
  if (config.database !== null) {
    try {
      db = await openDatabase(config.database, options);
    } catch (error) {
      // An unopenable database (e.g. an unsupported URL scheme) is a failed database check.
      console.error(`health check "${DATABASE_CHECK_NAME}" failed: could not open the database: ${errorLogLabel(error)}`);
      return { status: "unavailable", checks: { [DATABASE_CHECK_NAME]: "failed" } };
    }
  }
  const checks = collectHealthChecks(config, db);
  return runHealthChecks({ db, clock: systemClock, config }, { checks, timeoutMs: options.timeoutMs });
}

/**
 * The app's `getDatabase` first; then the configured handle when the app set `database.handle`, or for a
 * `pglite://` URL (one instance per process: a second on the same directory corrupts it, an in-memory one
 * would be a second, empty database); otherwise the handler's own small Postgres pool.
 */
function openDatabase(database: SoftureDatabaseConfig, options: OpsOptions): Promise<Queryable> {
  if (options.getDatabase !== undefined) {
    return options.getDatabase();
  }
  if (database.handle !== undefined || database.url.startsWith(PGLITE_PREFIX)) {
    return getConfiguredDatabase(database).then((handle) => handle.db);
  }
  return getHealthDatabase(database.url).then((handle) => handle.db);
}
