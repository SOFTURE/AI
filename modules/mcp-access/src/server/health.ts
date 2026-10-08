// The module's readiness probe for `GET /api/health` of `@softure-ai/ops`: the tokens table (with
// its grant column) and the grants table exist and answer, i.e. `softure migrate` ran every file.
// It reads no rows.
import { ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";

export const checkAccessTokensTable: HealthCheck = async (context) => {
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select grant_id from mcp.access_tokens limit 0`);
  await db.execute(sql`select 1 from mcp.oauth_grants join mcp.oauth_clients on oauth_clients.id = oauth_grants.client_id limit 0`);
  return ok();
};
