// Reading, listing and deleting stored files. Only live files (neither deleted nor expired) are found; an owner
// filter makes another owner's file read as missing.
import { err, errorLogLabel, ok, type Err, type Ok } from "@softure-ai/core";
import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import type { ByteRange, FilesLookupErrorCode, StoredFile } from "../contract.js";
import { files, type FileRow } from "../schema.js";
import { toStoredFile, type FilesContext } from "./context.js";
import { getFilesOptions } from "./options.js";
import { isLive, sumOwnerBytes } from "./queries.js";

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1000;

export interface FileLookupOptions {
  /** Only this owner's file; another owner's reads as missing. */
  readonly ownerId?: string;
}

/** The live row with this id, or undefined. Not a uuid reads as missing. */
export async function findLiveRow(ctx: FilesContext, fileId: string, options: FileLookupOptions = {}): Promise<FileRow | undefined> {
  if (!UUID_PATTERN.test(fileId)) return undefined;
  const conditions: SQL[] = [eq(files.id, fileId), isLive(ctx.clock.now())];
  if (options.ownerId !== undefined) conditions.push(eq(files.ownerId, options.ownerId));
  const [row] = await ctx.db
    .select()
    .from(files)
    .where(and(...conditions));
  return row;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A live file, or null. */
export async function findFile(ctx: FilesContext, fileId: string, options: FileLookupOptions = {}): Promise<StoredFile | null> {
  const row = await findLiveRow(ctx, fileId, options);
  return row === undefined ? null : toStoredFile(row);
}

export interface OpenFileOptions extends FileLookupOptions {
  /** Only these bytes; `end` past the file is clipped to its last byte. */
  readonly range?: ByteRange;
}

export interface OpenedFile {
  readonly file: StoredFile;
  readonly body: ReadableStream<Uint8Array>;
  /** The bytes `body` carries; the whole file when no range was asked. */
  readonly range: ByteRange | null;
}

export type OpenFileResult = Ok<OpenedFile> | Err<FilesLookupErrorCode>;

/** A live file's bytes as a stream. A row whose bytes are missing from storage reads as not found (and is logged). */
export async function openFile(ctx: FilesContext, fileId: string, options: OpenFileOptions = {}): Promise<OpenFileResult> {
  const row = await findLiveRow(ctx, fileId, options);
  if (row === undefined) return err("files.not_found");
  const range = options.range === undefined ? null : clipRange(options.range, row.size);
  if (range === false) return err("files.range_not_satisfiable");
  const body = await getFilesOptions(ctx.config).storage.get(row.storageKey, range ?? undefined);
  if (body === null) {
    console.error(`@softure-ai/files: file ${row.id} has a row but no bytes in storage`);
    return err("files.not_found");
  }
  return ok({ file: toStoredFile(row), body, range });
}

/** The range within a file of `size` bytes, or false when it starts past the end (or is malformed). */
export function clipRange(range: ByteRange, size: number): ByteRange | false {
  const isValid = Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && range.start >= 0 && range.end >= range.start;
  if (!isValid || range.start >= size) return false;
  return { start: range.start, end: Math.min(range.end, size - 1) };
}

export interface ListFilesInput {
  readonly ownerId: string;
  readonly kind?: string;
  /** At most this many, newest first; 100 by default, at most 1000. */
  readonly limit?: number;
  readonly offset?: number;
}

/** An owner's live files, newest first. */
export async function listFiles(ctx: FilesContext, input: ListFilesInput): Promise<StoredFile[]> {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? DEFAULT_LIST_LIMIT), 1), MAX_LIST_LIMIT);
  const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
  const conditions: SQL[] = [eq(files.ownerId, input.ownerId), isLive(ctx.clock.now())];
  if (input.kind !== undefined) conditions.push(eq(files.kind, input.kind));
  const rows = await ctx.db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt), desc(files.id))
    .limit(limit)
    .offset(offset);
  return rows.map(toStoredFile);
}

/** The bytes an owner keeps in live files, the figure the quota is checked against. */
export async function getOwnerUsage(ctx: FilesContext, ownerId: string): Promise<number> {
  return sumOwnerBytes(ctx.db, ownerId, ctx.clock.now());
}

export type DeleteFileResult = Ok<undefined> | Err<"files.not_found">;

/**
 * Deletes a file: it stops being found and served at once, its bytes leave storage, then its row goes. When the
 * storage delete fails the row stays marked deleted and `pruneFiles` finishes the job.
 */
export async function deleteFile(ctx: FilesContext, fileId: string, options: FileLookupOptions = {}): Promise<DeleteFileResult> {
  if (!UUID_PATTERN.test(fileId)) return err("files.not_found");
  const conditions: SQL[] = [eq(files.id, fileId), isNull(files.deletedAt)];
  if (options.ownerId !== undefined) conditions.push(eq(files.ownerId, options.ownerId));
  const [marked] = await ctx.db
    .update(files)
    .set({ deletedAt: ctx.clock.now() })
    .where(and(...conditions))
    .returning();
  if (marked === undefined) return err("files.not_found");
  await removeMarkedFile(ctx, marked);
  return ok();
}

/** Removes a deleted or expired file's bytes and then its row; answers whether both went. */
export async function removeMarkedFile(ctx: FilesContext, row: FileRow): Promise<boolean> {
  try {
    await getFilesOptions(ctx.config).storage.delete(row.storageKey);
  } catch (error) {
    console.error(`@softure-ai/files: deleting the bytes of file ${row.id} failed, pruneFiles retries: ${errorLogLabel(error)}`);
    return false;
  }
  await ctx.db.delete(files).where(eq(files.id, row.id));
  return true;
}
