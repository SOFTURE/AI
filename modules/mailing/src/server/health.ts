// The module's readiness probe for `GET /api/health` of `@softure-ai/ops`: the suppression list,
// the campaigns and the delivery ledger exist and answer, i.e. `softure migrate` ran. It reads no rows.
import { ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";

export const checkMailingTables: HealthCheck = async (context) => {
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select 1 from mailing.suppressions limit 0`);
  await db.execute(sql`select 1 from mailing.campaigns limit 0`);
  await db.execute(sql`select 1 from mailing.deliveries limit 0`);
  return ok();
};
