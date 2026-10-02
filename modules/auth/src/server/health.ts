// auth's readiness probe for `GET /api/health` of `@softure-ai/ops` (core's `defineModule({ health })`):
// auth can serve only when both of its tables exist and answer, i.e. after `softure migrate`. It
// reads no rows, so it stays cheap and runs as the row-limited app role.
import { ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";

export const checkAuthTables: HealthCheck = async (context) => {
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select 1 from auth.users limit 0`);
  await db.execute(sql`select 1 from auth.sessions limit 0`);
  return ok();
};
