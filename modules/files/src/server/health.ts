// The module's readiness probe for `GET /api/health` of `@softure-ai/ops`: the table answers (`softure migrate`
// ran), and the storage takes a write and keeps at least `health.minFreeBytes` free when its driver can tell.
import { err, ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";
import { getFilesOptions } from "./options.js";

export type FilesHealthErrorCode = "files.storage_unwritable" | "files.storage_low_space";

export const checkFilesHealth: HealthCheck = async (context) => {
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select 1 from files.files limit 0`);
  const options = getFilesOptions(context.config);
  const check = await options.storage.check?.();
  if (check === undefined) return ok();
  if (!check.isWritable) return err("files.storage_unwritable");
  if (check.freeBytes !== null && check.freeBytes < options.health.minFreeBytes) return err("files.storage_low_space");
  return ok();
};
