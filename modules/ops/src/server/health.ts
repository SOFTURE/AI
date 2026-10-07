// The health check runner behind `GET /api/health`: the database, then every enabled module that
// contributes a check (`defineModule({ health })`), then the app's own (`ops({ checks })`).
// Ported from FIRE_TRACKER `src/app/api/health/route.ts`, where a container with a dead Postgres
// answered 200 on `/login` because that page never touched the database: here health means a
// query that really goes through, and every module may add what "ready" means for it.
import { err, errorLogLabel, getModule, ok, type HealthCheck, type ModuleContext, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";
import type { HealthCheckState, HealthReport } from "../contract.js";
import type { OpsOptions } from "../options.js";

export const DATABASE_CHECK_NAME = "database";

export interface NamedHealthCheck {
  readonly name: string;
  readonly check: HealthCheck;
}

export interface RunHealthChecksOptions {
  readonly checks: readonly NamedHealthCheck[];
  /** How long one check may run before it counts as `timed_out`. */
  readonly timeoutMs: number;
  /** Where a failing check is reported; never the response. Default: `console.error`. */
  readonly log?: (line: string) => void;
}

/** The cheapest query that really goes through the connection pool. */
export function createDatabaseCheck(db: Queryable): HealthCheck {
  return async () => {
    await db.execute(sql`select 1`);
    return ok();
  };
}

/**
 * The check that stands in for the database when the config has none. Apps build `database` from
 * `DATABASE_URL`, so a missing secret leaves `null`; without this check a route with nothing else to
 * check would answer 200 for an app whose pages fail.
 */
export function createMissingDatabaseCheck(): HealthCheck {
  return () => Promise.resolve(err("ops.database_missing"));
}

/**
 * The checks to run for this config, in order: `database`, each enabled module's check under the
 * module id, then the app's checks from `ops({ checks })`. Without `db` the `database` check fails,
 * unless the app set `ops({ requireDatabase: false })`. Throws when two checks share a name: that
 * is a configuration bug.
 */
export function collectHealthChecks(config: SoftureConfig, db: Queryable | null): NamedHealthCheck[] {
  const options = getModule(config, "ops")?.options as OpsOptions | undefined;
  const checks: NamedHealthCheck[] = [];
  if (db !== null) {
    checks.push({ name: DATABASE_CHECK_NAME, check: createDatabaseCheck(db) });
  } else if (options?.requireDatabase ?? true) {
    checks.push({ name: DATABASE_CHECK_NAME, check: createMissingDatabaseCheck() });
  }
  for (const module of config.modules) {
    if (module.health !== null) {
      checks.push({ name: module.id, check: module.health });
    }
  }
  const appChecks = options?.checks ?? {};
  for (const [name, check] of Object.entries(appChecks)) {
    checks.push({ name, check });
  }

  const names = checks.map((entry) => entry.name);
  const repeated = names.filter((name, index) => names.indexOf(name) !== index);
  if (repeated.length > 0) {
    throw new Error(
      `collectHealthChecks: the check name "${repeated[0] ?? ""}" is used twice; rename the app check in ops({ checks })`,
    );
  }
  return checks;
}

/** Runs every check at once and reports `ok` only when all of them pass within `timeoutMs`. */
export async function runHealthChecks(context: ModuleContext, options: RunHealthChecksOptions): Promise<HealthReport> {
  const log = options.log ?? ((line: string) => console.error(line));
  const states = await Promise.all(
    options.checks.map(async ({ name, check }) => {
      const state = await runOne(check, context, options.timeoutMs, (cause) => log(`health check "${name}" ${cause}`));
      return [name, state] as const;
    }),
  );
  return {
    status: states.every(([, state]) => state === "ok") ? "ok" : "unavailable",
    checks: Object.fromEntries(states),
  };
}

async function runOne(
  check: HealthCheck,
  context: ModuleContext,
  timeoutMs: number,
  report: (cause: string) => void,
): Promise<HealthCheckState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timed_out">((resolve) => {
    timer = setTimeout(() => resolve("timed_out"), timeoutMs);
  });
  // A check that throws synchronously still counts as failed, not as a crash of the route.
  // A check that resolves to something other than a Result (a JavaScript module) fails the same way.
  const settled = Promise.resolve()
    .then(() => check(context))
    .then((result): HealthCheckState => {
      if (result.ok) return "ok";
      report(`failed: ${result.error}`);
      return "failed";
    })
    .catch((error: unknown): HealthCheckState => {
      report(`failed: ${errorLogLabel(error)}`);
      return "failed";
    });
  try {
    const state = await Promise.race([settled, timedOut]);
    if (state === "timed_out") {
      report(`timed out after ${String(timeoutMs)} ms`);
    }
    return state;
  } finally {
    clearTimeout(timer);
  }
}
