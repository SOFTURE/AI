// The files part of a GDPR export and deletion (`@softure-ai/privacy`). A file belongs to its owner: the export
// lists the owner's live files (never the bytes or the storage key; the app links them itself when it wants), and
// the deletion removes every file of the owner from storage and the table.
import { ok, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, asc, eq } from "drizzle-orm";
import type { StoredFile } from "../contract.js";
import { files } from "../schema.js";
import { toStoredFile, type FilesContext } from "./context.js";
import { removeMarkedFile } from "./files.js";
import { isLive } from "./queries.js";

/** What files holds about one user, as it appears in their export. */
export interface FilesUserData {
  readonly files: readonly StoredFile[];
}

export interface FilesDeletionReport {
  readonly deletedFiles: number;
  /** Files whose storage delete failed; their rows stay marked deleted and `pruneFiles` removes them. */
  readonly pendingFiles: number;
}

export async function exportFilesUserData(ctx: FilesContext, userId: string): Promise<Ok<FilesUserData>> {
  const rows = await ctx.db
    .select()
    .from(files)
    .where(and(eq(files.ownerId, userId), isLive(ctx.clock.now())))
    .orderBy(asc(files.createdAt), asc(files.id));
  return ok({ files: rows.map(toStoredFile) });
}

export async function deleteFilesUserData(ctx: FilesContext, userId: string): Promise<Ok<FilesDeletionReport>> {
  const now = ctx.clock.now();
  // Marked first, in one statement: nothing of the owner is served from here on, whatever storage does next.
  await ctx.db.update(files).set({ deletedAt: now }).where(eq(files.ownerId, userId));
  const rows = await ctx.db.select().from(files).where(eq(files.ownerId, userId));
  let deletedFiles = 0;
  for (const row of rows) {
    if (await removeMarkedFile(ctx, row)) deletedFiles += 1;
  }
  return ok({ deletedFiles, pendingFiles: rows.length - deletedFiles });
}

export const filesPrivacyContributor: PrivacyContributor = {
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  exportUserData: (context, userId) => exportFilesUserData({ ...context, db: context.db as Queryable }, userId),
  // Privacy's contract answers a deletion with an empty ok; the counts are for apps that call the helper.
  deleteUserData: async (context, userId) => {
    await deleteFilesUserData({ ...context, db: context.db as Queryable }, userId);
    return ok();
  },
};
