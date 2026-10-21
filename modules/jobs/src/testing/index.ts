// Test helpers of @softure-ai/jobs: run due jobs in-process against a test database (`createTestDatabase` from
// `@softure-ai/db/testing`) and read the tables back.
import type { Queryable } from "@softure-ai/db";
import { asc } from "drizzle-orm";
import type { Job } from "../contract.js";
import { jobs, syncCursors, syncItems } from "../schema.js";
import { toJob } from "../server/job-row.js";
import { toSyncItem } from "../server/sync-items.js";
import type { SyncItem } from "../sync.js";

export { runDueJobs, type RunDueJobsOptions, type RunDueJobsReport } from "../server/run-due.js";

/** Every job in the table, oldest first: for assertions. */
export async function listJobs(db: Queryable): Promise<Job[]> {
  const rows = await db.select().from(jobs).orderBy(asc(jobs.id));
  return rows.map(toJob);
}

export interface SyncState {
  /** Every source's cursor, by source name. */
  readonly cursors: Readonly<Record<string, string>>;
  /** Every ledger item, by source and then item id. */
  readonly items: SyncItem[];
}

/** The whole sync state, cursors and ledger: for assertions after a test ran its polling job (`runDueJobs`). */
export async function listSyncState(db: Queryable): Promise<SyncState> {
  const cursors = await db.select().from(syncCursors).orderBy(asc(syncCursors.source));
  const items = await db.select().from(syncItems).orderBy(asc(syncItems.source), asc(syncItems.itemId));
  return { cursors: Object.fromEntries(cursors.map((row) => [row.source, row.cursor])), items: items.map(toSyncItem) };
}
