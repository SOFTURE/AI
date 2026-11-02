// Upload sessions: a client that cannot hand the server a stream (an assistant in its own sandbox, a phone over a
// proxy with a body limit) sends a file in chunks to a signed URL, and `finalizeUpload` turns them into a stored file.
//
// Every chunk but the last is `chunk_size` bytes and starts at a multiple of it, so "which bytes arrived" is the set
// of chunk indices in `received_chunks`. Each chunk is its own object in storage (`uploads/<id>/<index>`), written
// atomically by the driver and recorded only once whole; a recorded chunk is never rewritten, so a finalize reads
// parts that cannot change under it. The finalize streams the parts in order into `saveFile`, which hashes, counts,
// applies the quota and dedupe and writes the one final object (multipart on S3), then the parts are removed.
import { createHash, randomUUID } from "node:crypto";
import { err, errorLogLabel, ok, type Err, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, asc, eq, gt, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { ByteRange, CreatedUpload, FilesKeyErrorCode, FilesSaveErrorCode, StoredFile, UploadState, UploadStatus } from "../contract.js";
import { uploads, type UploadRow } from "../schema.js";
import type { FileBody, FileStorage } from "../storage.js";
import type { FilesContext } from "./context.js";
import { deleteFile, findFile, UUID_PATTERN } from "./files.js";
import { readLinkKeyring } from "./keys.js";
import { getFilesOptions } from "./options.js";
import { sumOwnerBytes } from "./queries.js";
import { saveFile, validateFileDescription } from "./save.js";
import { signUploadPath } from "./upload-tokens.js";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const PART_PREFIX = "uploads";

export interface CreateUploadInput {
  readonly ownerId: string;
  /** The name the file will be saved under; only its last path part is kept, sanitised. */
  readonly name: string;
  /** Defaults to `application/octet-stream`; must match `uploads.contentTypes` when the app set it. */
  readonly contentType?: string;
  /** The exact size in bytes, at least 1 and at most `maxFileBytes`. */
  readonly size: number;
  /** The lowercase hex SHA-256 the bytes must have; checked at finalize. */
  readonly sha256?: string;
  /** The saved file's category; defaults to `file`. */
  readonly kind?: string;
  /** How long the session works, at most `uploads.ttlSeconds` (its default). */
  readonly ttlSeconds?: number;
}

export type CreateUploadResult =
  | Ok<CreatedUpload>
  | Err<"files.invalid_input" | "files.too_large" | "files.quota_exceeded" | "files.content_type_not_allowed" | "files.too_many_uploads" | FilesKeyErrorCode>;

/** Opens an upload session for `ownerId` and answers the URL the client sends the chunks to. */
export async function createUpload(ctx: FilesContext, input: CreateUploadInput): Promise<CreateUploadResult> {
  const options = getFilesOptions(ctx.config);
  const described = validateFileDescription(input);
  if (!described.ok) return described;
  const sha256 = input.sha256?.toLowerCase();
  const ttlSeconds = input.ttlSeconds ?? options.uploads.ttlSeconds;
  const isValid =
    Number.isSafeInteger(input.size) &&
    input.size >= 1 &&
    (sha256 === undefined || SHA256_PATTERN.test(sha256)) &&
    Number.isSafeInteger(ttlSeconds) &&
    ttlSeconds >= 1 &&
    ttlSeconds <= options.uploads.ttlSeconds;
  if (!isValid) return err("files.invalid_input");
  if (input.size > options.maxFileBytes) return err("files.too_large");
  if (!isContentTypeAllowed(described.value.contentType, options.uploads.contentTypes)) return err("files.content_type_not_allowed");
  const keyring = readLinkKeyring(ctx.env ?? process.env);
  if (!keyring.ok) return keyring;

  const now = ctx.clock.now();
  const id = randomUUID();
  // Whole seconds, so the URL's expiry and the row's agree.
  const expiresAt = new Date((Math.floor(now.getTime() / 1000) + ttlSeconds) * 1000);
  const chunkSize = options.uploads.chunkBytes;
  const opened = await ctx.db.transaction(async (tx: Queryable) => {
    // The same lock as saveFile: the quota and the open sessions are read with nothing of this owner changing.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`files:${input.ownerId}`}, 0))`);
    const [open] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(uploads)
      .where(and(eq(uploads.ownerId, input.ownerId), isNull(uploads.fileId), gt(uploads.expiresAt, now)));
    if ((open?.count ?? 0) >= options.uploads.maxOpenPerOwner) return err("files.too_many_uploads");
    if (options.quotaBytesPerOwner !== null && (await sumOwnerBytes(tx, input.ownerId, now)) + input.size > options.quotaBytesPerOwner) {
      return err("files.quota_exceeded");
    }
    await tx.insert(uploads).values({
      id,
      ownerId: input.ownerId,
      ...described.value,
      size: input.size,
      sha256: sha256 ?? null,
      chunkSize,
      receivedChunks: [],
      expiresAt,
      createdAt: now,
    });
    return ok();
  });
  if (!opened.ok) return opened;
  const path = signUploadPath(ctx, keyring.value, id, expiresAt);
  return ok({
    uploadId: id,
    uploadUrl: new URL(path, ctx.config.appOrigin).toString(),
    chunkSize,
    chunkCount: countChunks(input.size, chunkSize),
    expiresAt,
  });
}

export interface UploadLookupOptions {
  /** Only this owner's session; another owner's reads as missing. */
  readonly ownerId?: string;
}

/** A session that has not expired, or null. A finalized one is answered too (state `finalized`). */
export async function getUpload(ctx: FilesContext, uploadId: string, options: UploadLookupOptions = {}): Promise<UploadStatus | null> {
  const row = await findUploadRow(ctx, uploadId, options);
  return row === undefined ? null : toUploadStatus(row, ctx.clock.now());
}

/** The chunk a request carries: a byte range of the file, or null for the whole file in one request. */
export interface WriteUploadChunkInput {
  readonly range: ByteRange | null;
  /** The total the client declared (`Content-Range: bytes a-b/<total>`); must be the session's size. */
  readonly total?: number;
  readonly body: FileBody;
}

/** Why a chunk was refused. */
export type UploadChunkErrorCode =
  /** No open session has this id (unknown, finalized or expired). */
  | "files.not_found"
  /** The range is not one chunk of this session (misaligned, wrong length, wrong total, a file larger than one chunk without a range). */
  | "files.invalid_range"
  /** The body had fewer or more bytes than the range. */
  | "files.chunk_length_mismatch";

export type WriteUploadChunkResult = Ok<UploadStatus> | Err<UploadChunkErrorCode>;

/** Thrown into the driver's write when a body passes its range; the driver drops the partial object. */
class ChunkOverflowError extends Error {
  constructor() {
    super("@softure-ai/files: the chunk body passed its range");
  }
}

/**
 * Stores one chunk of an open session. A chunk that already arrived is answered as is, without reading the body:
 * a client that resends it after a lost answer loses nothing. A storage failure propagates.
 */
export async function writeUploadChunk(ctx: FilesContext, uploadId: string, input: WriteUploadChunkInput): Promise<WriteUploadChunkResult> {
  const row = await findUploadRow(ctx, uploadId);
  if (row?.fileId !== null || row.expiresAt.getTime() <= ctx.clock.now().getTime()) return err("files.not_found");
  const index = findChunkIndex(row, input);
  if (index === null) return err("files.invalid_range");
  if (row.receivedChunks.includes(index)) return ok(toUploadStatus(row, ctx.clock.now()));

  const expected = getChunkLength(row, index);
  const storage = getFilesOptions(ctx.config).storage;
  const key = getPartKey(row.id, index);
  let length = 0;
  async function* capped(): AsyncGenerator<Uint8Array> {
    for await (const chunk of input.body as AsyncIterable<Uint8Array | string>) {
      const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      length += bytes.byteLength;
      if (length > expected) throw new ChunkOverflowError();
      yield bytes;
    }
  }
  try {
    await storage.put(capped(), key);
  } catch (error) {
    if (error instanceof ChunkOverflowError) return err("files.chunk_length_mismatch");
    throw error;
  }
  if (length !== expected) {
    await deletePartQuietly(storage, key);
    return err("files.chunk_length_mismatch");
  }
  // One statement, so parallel chunks of one session never lose each other's index.
  const [updated] = await ctx.db
    .update(uploads)
    .set({
      receivedChunks: sql`case when ${index}::int = any(${uploads.receivedChunks}) then ${uploads.receivedChunks} else array_append(${uploads.receivedChunks}, ${index}::int) end`,
    })
    .where(and(eq(uploads.id, row.id), isNull(uploads.fileId)))
    .returning();
  // Finalized in the meantime: the part is not needed, and the session no longer takes chunks.
  if (updated === undefined) {
    await deletePartQuietly(storage, key);
    return err("files.not_found");
  }
  return ok(toUploadStatus(updated, ctx.clock.now()));
}

export type FinalizeUploadResult = Ok<StoredFile> | Err<"files.not_found" | "files.upload_incomplete" | "files.checksum_mismatch" | FilesSaveErrorCode>;

/** Thrown into the save when a part is missing from storage. */
class MissingPartError extends Error {
  constructor(readonly index: number) {
    super(`@softure-ai/files: upload part ${String(index)} is missing from storage`);
  }
}

/** Thrown into the save when the bytes do not match the declared size or SHA-256; the save drops its object. */
class ContentMismatchError extends Error {
  constructor() {
    super("@softure-ai/files: the uploaded bytes do not match the declared size or SHA-256");
  }
}

/**
 * Turns a complete session into a stored file: every chunk present, the size and the declared SHA-256 checked while
 * the parts stream into `saveFile` (quota and dedupe as there), then the parts are removed. Calling it again answers
 * the same file; two parallel calls keep one.
 */
export async function finalizeUpload(ctx: FilesContext, uploadId: string, options: UploadLookupOptions = {}): Promise<FinalizeUploadResult> {
  const row = await findUploadRow(ctx, uploadId, options);
  if (row === undefined) return err("files.not_found");
  if (row.fileId !== null) return answerFinalizedFile(ctx, row.fileId);
  const chunkCount = countChunks(row.size, row.chunkSize);
  if (row.receivedChunks.length < chunkCount) return err("files.upload_incomplete");

  const storage = getFilesOptions(ctx.config).storage;
  let saved;
  try {
    saved = await saveFile(ctx, {
      ownerId: row.ownerId,
      name: row.originalName,
      contentType: row.contentType,
      kind: row.kind,
      body: readParts(storage, row, chunkCount),
    });
  } catch (error) {
    if (error instanceof ContentMismatchError) return err("files.checksum_mismatch");
    if (!(error instanceof MissingPartError)) throw error;
    console.error(`@softure-ai/files: upload ${row.id} lost part ${String(error.index)} in storage; the client must send it again`);
    await ctx.db
      .update(uploads)
      .set({ receivedChunks: sql`array_remove(${uploads.receivedChunks}, ${error.index}::int)` })
      .where(eq(uploads.id, row.id));
    return err("files.upload_incomplete");
  }
  if (!saved.ok) return saved;

  const [claimed] = await ctx.db
    .update(uploads)
    .set({ fileId: saved.value.id, finalizedAt: ctx.clock.now() })
    .where(and(eq(uploads.id, row.id), isNull(uploads.fileId)))
    .returning();
  if (claimed === undefined) {
    // Another finalize won: keep its file, drop this copy (unless dedupe answered that very file).
    const winner = await findUploadRow(ctx, row.id);
    const winnerFileId = winner?.fileId ?? null;
    if (winnerFileId !== saved.value.id) await deleteFile(ctx, saved.value.id);
    return winnerFileId === null ? err("files.not_found") : answerFinalizedFile(ctx, winnerFileId);
  }
  await deleteParts(storage, row);
  return saved;
}

/** Removes sessions whose time is up, with their parts; answers how many went and how many must wait for the next run. */
export async function pruneUploads(ctx: FilesContext, batchSize: number): Promise<{ readonly deletedUploads: number; readonly failedUploads: number }> {
  const storage = getFilesOptions(ctx.config).storage;
  const now = ctx.clock.now();
  let deletedUploads = 0;
  let failedUploads = 0;
  for (;;) {
    const rows = await ctx.db
      .select()
      .from(uploads)
      .where(lte(uploads.expiresAt, now))
      .orderBy(asc(uploads.expiresAt), asc(uploads.id))
      .limit(batchSize)
      .offset(failedUploads);
    for (const row of rows) {
      if (await removeUpload(ctx, storage, row)) deletedUploads += 1;
      else failedUploads += 1;
    }
    if (rows.length < batchSize) return { deletedUploads, failedUploads };
  }
}

/** An owner's sessions with their parts (the privacy deletion); answers how many went and how many stay for prune. */
export async function deleteOwnerUploads(ctx: FilesContext, ownerId: string): Promise<{ readonly deletedUploads: number; readonly failedUploads: number }> {
  const storage = getFilesOptions(ctx.config).storage;
  const rows = await ctx.db.select().from(uploads).where(eq(uploads.ownerId, ownerId));
  let deletedUploads = 0;
  for (const row of rows) {
    if (await removeUpload(ctx, storage, row)) deletedUploads += 1;
  }
  return { deletedUploads, failedUploads: rows.length - deletedUploads };
}

/** An owner's sessions that still take chunks (the privacy export). */
export async function listOpenUploads(ctx: FilesContext, ownerId: string): Promise<UploadStatus[]> {
  const now = ctx.clock.now();
  const rows = await ctx.db
    .select()
    .from(uploads)
    .where(and(eq(uploads.ownerId, ownerId), isNull(uploads.fileId), gt(uploads.expiresAt, now)))
    .orderBy(asc(uploads.createdAt), asc(uploads.id));
  return rows.map((row) => toUploadStatus(row, now));
}

/** The storage key of one chunk of a session. */
export function getPartKey(uploadId: string, index: number): string {
  return `${PART_PREFIX}/${uploadId}/${String(index)}`;
}

/** How many chunks a file of `size` bytes takes. */
export function countChunks(size: number, chunkSize: number): number {
  return Math.ceil(size / chunkSize);
}

/** The session row, unless it expired. Not a uuid reads as missing. */
async function findUploadRow(ctx: FilesContext, uploadId: string, options: UploadLookupOptions = {}): Promise<UploadRow | undefined> {
  if (!UUID_PATTERN.test(uploadId)) return undefined;
  const conditions: SQL[] = [eq(uploads.id, uploadId), gt(uploads.expiresAt, ctx.clock.now())];
  if (options.ownerId !== undefined) conditions.push(eq(uploads.ownerId, options.ownerId));
  const [row] = await ctx.db
    .select()
    .from(uploads)
    .where(and(...conditions));
  return row;
}

async function answerFinalizedFile(ctx: FilesContext, fileId: string): Promise<Ok<StoredFile> | Err<"files.not_found">> {
  const file = await findFile(ctx, fileId);
  return file === null ? err("files.not_found") : ok(file);
}

/** The chunk index a request's range names, or null when it is not exactly one chunk of the session. */
function findChunkIndex(row: UploadRow, input: WriteUploadChunkInput): number | null {
  if (input.total !== undefined && input.total !== row.size) return null;
  if (input.range === null) return row.size <= row.chunkSize ? 0 : null;
  const { start, end } = input.range;
  if (!Number.isSafeInteger(start) || start < 0 || start % row.chunkSize !== 0 || start >= row.size) return null;
  const index = start / row.chunkSize;
  return end === start + getChunkLength(row, index) - 1 ? index : null;
}

function getChunkLength(row: Pick<UploadRow, "size" | "chunkSize">, index: number): number {
  return Math.min(row.chunkSize, row.size - index * row.chunkSize);
}

/** The parts in order, checked against the declared size and SHA-256 as they pass. */
async function* readParts(storage: FileStorage, row: UploadRow, chunkCount: number): AsyncGenerator<Uint8Array> {
  const hash = createHash("sha256");
  let size = 0;
  for (let index = 0; index < chunkCount; index += 1) {
    const stream = await storage.get(getPartKey(row.id, index));
    if (stream === null) throw new MissingPartError(index);
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      hash.update(value);
      yield value;
    }
  }
  if (size !== row.size || (row.sha256 !== null && hash.digest("hex") !== row.sha256)) throw new ContentMismatchError();
}

function toUploadStatus(row: UploadRow, now: Date): UploadStatus {
  const chunkCount = countChunks(row.size, row.chunkSize);
  const received = new Set(row.receivedChunks);
  const missingChunks = Array.from({ length: chunkCount }, (_, index) => index).filter((index) => !received.has(index));
  return {
    uploadId: row.id,
    name: row.originalName,
    contentType: row.contentType,
    size: row.size,
    chunkSize: row.chunkSize,
    chunkCount,
    received: mergeChunkRanges(row, [...received].sort((left, right) => left - right)),
    receivedBytes: [...received].reduce((total, index) => total + getChunkLength(row, index), 0),
    missingChunks,
    state: getUploadState(row, missingChunks.length, now),
    fileId: row.fileId,
    expiresAt: row.expiresAt,
  };
}

function getUploadState(row: UploadRow, missingCount: number, now: Date): UploadState {
  if (row.fileId !== null) return "finalized";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return missingCount === 0 ? "complete" : "open";
}

/** Sorted chunk indices as merged byte ranges. */
function mergeChunkRanges(row: UploadRow, indices: readonly number[]): ByteRange[] {
  const ranges: ByteRange[] = [];
  for (const index of indices) {
    const start = index * row.chunkSize;
    const end = start + getChunkLength(row, index) - 1;
    const last = ranges.at(-1);
    if (last !== undefined && last.end + 1 === start) ranges[ranges.length - 1] = { start: last.start, end };
    else ranges.push({ start, end });
  }
  return ranges;
}

/** Whether a normalised media type matches one of the allowed rules (`video/mp4`, `video/*`); null allows any. */
function isContentTypeAllowed(contentType: string, rules: readonly string[] | null): boolean {
  if (rules === null) return true;
  const essence = contentType.split(";")[0] ?? "";
  const [type = ""] = essence.split("/");
  return rules.some((rule) => rule === essence || rule === `${type}/*`);
}

/** Removes a session's parts and then its row; answers whether both went. */
async function removeUpload(ctx: FilesContext, storage: FileStorage, row: UploadRow): Promise<boolean> {
  try {
    for (let index = 0; index < countChunks(row.size, row.chunkSize); index += 1) await storage.delete(getPartKey(row.id, index));
  } catch (error) {
    console.error(`@softure-ai/files: deleting the parts of upload ${row.id} failed, pruneFiles retries: ${errorLogLabel(error)}`);
    return false;
  }
  await ctx.db.delete(uploads).where(eq(uploads.id, row.id));
  return true;
}

/** Removes the parts of a finalized session; a failure is logged and the prune of the expired session retries. */
async function deleteParts(storage: FileStorage, row: UploadRow): Promise<void> {
  try {
    for (let index = 0; index < countChunks(row.size, row.chunkSize); index += 1) await storage.delete(getPartKey(row.id, index));
  } catch (error) {
    console.error(`@softure-ai/files: deleting the parts of finalized upload ${row.id} failed, pruneFiles retries: ${errorLogLabel(error)}`);
  }
}

async function deletePartQuietly(storage: FileStorage, key: string): Promise<void> {
  try {
    await storage.delete(key);
  } catch (error) {
    console.error(`@softure-ai/files: deleting a refused upload part failed: ${errorLogLabel(error)}`);
  }
}
