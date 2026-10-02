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
    try {
      db = (await getHealthDatabase(config.database.url)).db;
    } catch (error) {
      // An unopenable database (e.g. an unsupported URL scheme) is a failed database check.
      console.error(`health check "${DATABASE_CHECK_NAME}" failed: could not open the database: ${errorLogLabel(error)}`);
      return { status: "unavailable", checks: { [DATABASE_CHECK_NAME]: "failed" } };
    }
  }
  const checks = collectHealthChecks(config, db);
  return runHealthChecks({ db, clock: systemClock, config }, { checks, timeoutMs: options.timeoutMs });
}
