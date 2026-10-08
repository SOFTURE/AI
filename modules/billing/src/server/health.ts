// The module's readiness probe for `GET /api/health` of `@softure-ai/ops`: the entitlements,
// payments, payment requests, manual grants and trial extensions tables exist and answer, i.e. `softure migrate` ran,
// and the setup is sound (`adminRole` is declared), so a deploy fails before traffic. It reads no rows.
import { ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";
import { assertAdminRoleDeclared } from "./setup.js";

export const checkBillingTables: HealthCheck = async (context) => {
  assertAdminRoleDeclared(context.config);
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select 1 from billing.entitlements limit 0`);
  await db.execute(sql`select 1 from billing.payments limit 0`);
  await db.execute(sql`select 1 from billing.payment_requests limit 0`);
  await db.execute(sql`select 1 from billing.manual_grants limit 0`);
  await db.execute(sql`select 1 from billing.trial_extensions limit 0`);
  return ok();
};
