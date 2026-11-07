// Retention: files past their expiry and files deleted but not yet out of storage leave storage, then the table;
// upload sessions past their expiry leave with their parts.
// Run it from the `files.prune` job (`@softure-ai/files/jobs`) or a cron calling `pruneFiles(ctx)`.
import { asc, isNotNull, lte, or } from "drizzle-orm";
import { files } from "../schema.js";
import type { FilesContext } from "./context.js";
import { removeMarkedFile } from "./files.js";
import { pruneUploads } from "./uploads.js";

const DEFAULT_BATCH_SIZE = 500;

/** How many removed file ids a prune report keeps (`removedFileIds`). */
export const PRUNE_REPORT_MAX_FILE_IDS = 10;

export interface PruneFilesOptions {
  /** Rows read per round; rounds repeat until one comes back short. */
  readonly batchSize?: number;
}

export interface PruneFilesReport {
  readonly deletedFiles: number;
  readonly freedBytes: number;
  /** Ids of the first `PRUNE_REPORT_MAX_FILE_IDS` (10) removed files, in removal order; `deletedFiles` has the count. */
  readonly removedFileIds: readonly string[];
  /** Files whose storage delete failed; they stay for the next run. */
  readonly failedFiles: number;
  /** Expired upload sessions removed with their parts. */
  readonly deletedUploads: number;
  /** Expired upload sessions whose parts could not be deleted; they stay for the next run. */
  readonly failedUploads: number;
}

export async function pruneFiles(ctx: FilesContext, options: PruneFilesOptions = {}): Promise<PruneFilesReport> {
  const batchSize = Math.max(1, Math.trunc(options.batchSize ?? DEFAULT_BATCH_SIZE));
  const now = ctx.clock.now();
  let deletedFiles = 0;
  let freedBytes = 0;
  let failedFiles = 0;
  const removedFileIds: string[] = [];
  for (;;) {
    const rows = await ctx.db
      .select()
      .from(files)
      .where(or(isNotNull(files.deletedAt), lte(files.expiresAt, now)))
      .orderBy(asc(files.createdAt), asc(files.id))
      .limit(batchSize)
      .offset(failedFiles);
    for (const row of rows) {
      if (await removeMarkedFile(ctx, row)) {
        deletedFiles += 1;
        freedBytes += row.size;
        if (removedFileIds.length < PRUNE_REPORT_MAX_FILE_IDS) removedFileIds.push(row.id);
      } else {
        failedFiles += 1;
      }
    }
    if (rows.length < batchSize) {
      return { deletedFiles, freedBytes, removedFileIds, failedFiles, ...(await pruneUploads(ctx, batchSize)) };
    }
  }
}
