// The module's readiness probe for `GET /api/health` of `@softure-ai/ops`: the switches table
// exists and answers, i.e. `softure migrate` ran. It reads no rows.
import { ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";

export const checkSwitchesTable: HealthCheck = async (context) => {
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select 1 from features.switches limit 0`);
  return ok();
};
