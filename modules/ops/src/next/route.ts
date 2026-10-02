// `GET /api/health`, shipped in the package and mounted with one line:
// `app/api/health/route.ts → export { GET } from "@softure-ai/ops/next"`.
//
// A public route without a session: the answer is `{ status }` and a code, 200 "will take traffic"
// or 503 "will not", and nothing else unless the app opts into `detail: "checks"`. Causes go to the
// server log only (FIRE_TRACKER L-021). It takes no input and costs one cheap query per check, so
// instead of a database-backed rate limit (which would make health depend on the database it
// reports on) concurrent requests share one run.
import { errorLogLabel, getModule, systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import type { Queryable } from "@softure-ai/db";
import type { HealthReport } from "../contract.js";
import { MODULE_ID } from "../index.js";
import type { OpsOptions } from "../options.js";
import { collectHealthChecks, DATABASE_CHECK_NAME, runHealthChecks } from "../server/health.js";
import { getHealthDatabase } from "./database.js";

const PGLITE_PREFIX = "pglite://";

let inFlight: Promise<HealthReport> | null = null;

export async function GET(): Promise<Response> {
  const config = getSoftureConfig();
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
    if (options.getDatabase === undefined && config.database.url.startsWith(PGLITE_PREFIX)) {
      // A setup bug, not an outage: thrown, so the route answers 500 and the log names the fix.
      throw new Error("GET /api/health: a pglite:// database cannot be opened a second time; pass ops({ getDatabase })");
    }
    try {
      db = await openDatabase(config.database.url, options);
    } catch (error) {
      // An unopenable database (e.g. an unsupported URL scheme) is a failed database check.
      console.error(`health check "${DATABASE_CHECK_NAME}" failed: could not open the database: ${errorLogLabel(error)}`);
      return { status: "unavailable", checks: { [DATABASE_CHECK_NAME]: "failed" } };
    }
  }
  const checks = collectHealthChecks(config, db);
  return runHealthChecks({ db, clock: systemClock, config }, { checks, timeoutMs: options.timeoutMs });
}

function openDatabase(url: string, options: OpsOptions): Promise<Queryable> {
  if (options.getDatabase !== undefined) {
    return options.getDatabase();
  }
  return getHealthDatabase(url).then((handle) => handle.db);
}
