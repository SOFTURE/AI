// The guestbook's readiness probe, contributed to `GET /api/health` through `defineModule({ health })`:
// the module can serve only when its table exists and answers, i.e. after `softure migrate`.
import { ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";

export const checkGuestbook: HealthCheck = async (context) => {
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select 1 from guestbook.entries limit 1`);
  return ok();
};
