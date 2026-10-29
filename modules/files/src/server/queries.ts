// Conditions and reads shared by the server functions.
import { and, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Queryable } from "@softure-ai/db";
import { files } from "../schema.js";

/** A file that is neither deleted nor past its expiry at `now`. */
export function isLive(now: Date): SQL {
  // `and` of two defined conditions is defined.
  return and(isNull(files.deletedAt), or(isNull(files.expiresAt), gt(files.expiresAt, now))) as SQL;
}

/** The bytes an owner keeps in live files. */
export async function sumOwnerBytes(db: Queryable, ownerId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${files.size}), 0)::text` })
    .from(files)
    .where(and(eq(files.ownerId, ownerId), isLive(now)));
  return Number(row?.total ?? "0");
}
