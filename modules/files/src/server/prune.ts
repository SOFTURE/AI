// Retention: files past their expiry and files deleted but not yet out of storage leave storage, then the table.
// Run it from the `files.prune` job (`@softure-ai/files/jobs`) or a cron calling `pruneFiles(ctx)`.
import { asc, isNotNull, lte, or } from "drizzle-orm";
import { files } from "../schema.js";
import type { FilesContext } from "./context.js";
import { removeMarkedFile } from "./files.js";

const DEFAULT_BATCH_SIZE = 500;

export interface PruneFilesOptions {
  /** Rows read per round; rounds repeat until one comes back short. */
  readonly batchSize?: number;
}

export interface PruneFilesReport {
  readonly deletedFiles: number;
  readonly freedBytes: number;
  /** Files whose storage delete failed; they stay for the next run. */
  readonly failedFiles: number;
}

export async function pruneFiles(ctx: FilesContext, options: PruneFilesOptions = {}): Promise<PruneFilesReport> {
  const batchSize = Math.max(1, Math.trunc(options.batchSize ?? DEFAULT_BATCH_SIZE));
  const now = ctx.clock.now();
  let deletedFiles = 0;
  let freedBytes = 0;
  let failedFiles = 0;
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
      } else {
        failedFiles += 1;
      }
    }
    if (rows.length < batchSize) return { deletedFiles, freedBytes, failedFiles };
  }
}
