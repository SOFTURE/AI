// The cursor of a polled source: where its next read starts. It moves only by compare-and-set, so a worker that read
// an older cursor cannot move it back over a newer one; a crash before the move re-reads the batch instead of skipping it.
import { err, ok, type Result } from "@softure-ai/core";
import { and, eq } from "drizzle-orm";
import { syncCursors } from "../schema.js";
import type { JobsContext } from "./context.js";

/** A source name: lowercase letters, digits, `_ . : -`, starting with a letter, up to 127 characters. */
export const SYNC_SOURCE = /^[a-z][a-z0-9_.:-]{0,126}$/;
const MAX_CURSOR_LENGTH = 2000;

export interface AdvanceSyncCursorInput {
  readonly source: string;
  /** The cursor the batch was read from, as `getSyncCursor` returned it; null for the first batch. */
  readonly from: string | null;
  /** Where the next batch starts. */
  readonly to: string;
}

/** The source's cursor, or null before its first `advanceSyncCursor`. Throws on an invalid source name. */
export async function getSyncCursor(ctx: JobsContext, source: string): Promise<string | null> {
  checkSyncSource(source);
  const [row] = await ctx.db.select({ cursor: syncCursors.cursor }).from(syncCursors).where(eq(syncCursors.source, source));
  return row?.cursor ?? null;
}

/**
 * Moves the source's cursor from `from` to `to`, after the batch read from `from` was handled. Refused with
 * `jobs.sync_cursor_moved` when the stored cursor is no longer `from` (another worker moved it first): re-read from
 * `getSyncCursor`. `ctx.db` may be a transaction, so the move commits with the batch's last writes. Throws on an
 * invalid source name or cursor; database failures propagate.
 */
export async function advanceSyncCursor(ctx: JobsContext, input: AdvanceSyncCursorInput): Promise<Result<undefined, "jobs.sync_cursor_moved">> {
  checkSyncSource(input.source);
  checkCursor(input.to);
  if (input.from !== null) checkCursor(input.from);
  const now = ctx.clock.now();

  if (input.from === null) {
    const inserted = await ctx.db
      .insert(syncCursors)
      .values({ source: input.source, cursor: input.to, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: syncCursors.source })
      .returning({ source: syncCursors.source });
    return inserted.length === 1 ? ok() : err("jobs.sync_cursor_moved");
  }

  const updated = await ctx.db
    .update(syncCursors)
    .set({ cursor: input.to, updatedAt: now })
    .where(and(eq(syncCursors.source, input.source), eq(syncCursors.cursor, input.from)))
    .returning({ source: syncCursors.source });
  return updated.length === 1 ? ok() : err("jobs.sync_cursor_moved");
}

/** Throws on a name the tables refuse: a typo in code, not a user error. */
export function checkSyncSource(source: string): void {
  if (!SYNC_SOURCE.test(source)) {
    throw new RangeError(`@softure-ai/jobs: "${source}" is not a sync source name: lowercase letters, digits, _ . : and -, starting with a letter, up to 127 characters`);
  }
}

function checkCursor(cursor: string): void {
  if (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) {
    throw new RangeError(`@softure-ai/jobs: a sync cursor must have 1 to ${String(MAX_CURSOR_LENGTH)} characters`);
  }
}
