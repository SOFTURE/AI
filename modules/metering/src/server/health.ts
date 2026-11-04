// The module's readiness probe for `GET /api/health` of `@softure-ai/ops`: the charges and budget limits tables
// exist and answer, i.e. `softure migrate` ran. It reads no rows.
import { ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";

export const checkChargesTable: HealthCheck = async (context) => {
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select 1 from metering.charges limit 0`);
  await db.execute(sql`select 1 from metering.budget_limits limit 0`);
  return ok();
};
