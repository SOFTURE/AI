// The module's readiness probe for `GET /api/health` of `@softure-ai/ops`: the tables exist and answer, i.e.
// `softure migrate` ran. It reads no rows and needs no key: a missing keyring shows on the page instead.
import { ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";

export const checkConnectionsTables: HealthCheck = async (context) => {
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select 1 from connections.accounts, connections.oauth_states limit 0`);
  return ok();
};
