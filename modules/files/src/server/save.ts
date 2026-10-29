// Saving a file: the body is hashed and counted while it streams into the storage driver, so memory holds one
// chunk at a time, and the size cap stops it at the first chunk over. The row goes in afterwards, under a per-owner
// advisory lock that serializes the quota check (and the dedupe lookup) with other saves for the same owner. Any
// refusal after the write deletes the blob it wrote.
import { createHash, randomUUID, type Hash } from "node:crypto";
import { createReadStream } from "node:fs";
import { err, errorLogLabel, ok, type Err, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, eq, sql } from "drizzle-orm";
import type { FilesSaveErrorCode, StoredFile } from "../contract.js";
import { DEFAULT_FILE_KIND, FILE_KIND_PATTERN } from "../options.js";
import { files } from "../schema.js";
import type { FileBody, FileStorage } from "../storage.js";
import { getStorageKey, toStoredFile, type FilesContext } from "./context.js";
import { DEFAULT_CONTENT_TYPE, normalizeContentType, sanitizeFileName } from "./names.js";
import { getFilesOptions } from "./options.js";
import { isLive, sumOwnerBytes } from "./queries.js";

const MAX_OWNER_ID_LENGTH = 200;

interface SaveFileFields {
  readonly ownerId: string;
  /** The name the file came with; only its last path part is kept, sanitised. */
  readonly name: string;
  /** Defaults to `application/octet-stream`. */
  readonly contentType?: string;
  /** The app's own category; defaults to `file`. */
  readonly kind?: string;
  /** When the file stops being served and `pruneFiles` removes it; give this or `ttlSeconds`, or neither. */
  readonly expiresAt?: Date;
  readonly ttlSeconds?: number;
}

/** A file from a stream (a request body, a renderer's output) or from a path on the server's disk. */
export type SaveFileInput = SaveFileFields & ({ readonly body: FileBody; readonly path?: never } | { readonly path: string; readonly body?: never });

export type SaveFileResult = Ok<StoredFile> | Err<FilesSaveErrorCode>;

/** Thrown into the driver's write when the body passes the cap; the driver drops the partial object. */
class SizeLimitError extends Error {
  constructor() {
    super("@softure-ai/files: the body passed the size limit");
  }
}

interface Meter {
  size: number;
  readonly hash: Hash;
}

async function* meterBody(body: FileBody, limit: number, meter: Meter): AsyncGenerator<Uint8Array> {
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    // A Node stream with an encoding set yields strings.
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    meter.size += bytes.byteLength;
    if (meter.size > limit) throw new SizeLimitError();
    meter.hash.update(bytes);
    yield bytes;
  }
}

/** Saves a file for `ownerId`. A storage failure propagates; refusals are codes. */
export async function saveFile(ctx: FilesContext, input: SaveFileInput): Promise<SaveFileResult> {
  const options = getFilesOptions(ctx.config);
  const now = ctx.clock.now();
  const fields = validateFields(input, now, options.defaultTtlSeconds);
  if (!fields.ok) return fields;

  const remaining = options.quotaBytesPerOwner === null ? Infinity : options.quotaBytesPerOwner - (await sumOwnerBytes(ctx.db, input.ownerId, now));
  if (remaining < 0) return err("files.quota_exceeded");
  const limit = Math.min(options.maxFileBytes, remaining);

  const id = randomUUID();
  const storageKey = getStorageKey(id);
  const meter: Meter = { size: 0, hash: createHash("sha256") };
  const source: FileBody = input.body ?? createReadStream(input.path);
  try {
    await options.storage.put(meterBody(source, limit, meter), storageKey);
  } catch (error) {
    await deleteBlobQuietly(options.storage, storageKey);
    if (error instanceof SizeLimitError) return err(meter.size > options.maxFileBytes ? "files.too_large" : "files.quota_exceeded");
    throw error;
  }

  const sha256 = meter.hash.digest("hex");
  let stored: Ok<{ row: StoredFile; isDuplicate: boolean }> | Err<"files.quota_exceeded">;
  try {
    stored = await ctx.db.transaction(async (tx: Queryable) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`files:${input.ownerId}`}, 0))`);
      if (options.dedupe) {
        const [existing] = await tx
          .select()
          .from(files)
          .where(and(eq(files.ownerId, input.ownerId), eq(files.sha256, sha256), isLive(now)))
          .limit(1);
        if (existing !== undefined) return ok({ row: toStoredFile(existing), isDuplicate: true });
      }
      if (options.quotaBytesPerOwner !== null && (await sumOwnerBytes(tx, input.ownerId, now)) + meter.size > options.quotaBytesPerOwner) {
        return err("files.quota_exceeded");
      }
      const [row] = await tx
        .insert(files)
        .values({
          id,
          ownerId: input.ownerId,
          sha256,
          size: meter.size,
          ...fields.value,
          storageKey,
          linkGeneration: 1,
          createdAt: now,
        })
        .returning();
      // An insert with returning answers the row it wrote.
      if (row === undefined) throw new Error("@softure-ai/files: the insert returned no row");
      return ok({ row: toStoredFile(row), isDuplicate: false });
    });
  } catch (error) {
    await deleteBlobQuietly(options.storage, storageKey);
    throw error;
  }
  if (!stored.ok || stored.value.isDuplicate) await deleteBlobQuietly(options.storage, storageKey);
  return stored.ok ? ok(stored.value.row) : stored;
}

interface ValidFields {
  readonly originalName: string;
  readonly contentType: string;
  readonly kind: string;
  readonly expiresAt: Date | null;
}

function validateFields(input: SaveFileInput, now: Date, defaultTtlSeconds: number | null): Ok<ValidFields> | Err<"files.invalid_input"> {
  if (input.ownerId.length === 0 || input.ownerId.length > MAX_OWNER_ID_LENGTH) return err("files.invalid_input");
  const kind = input.kind ?? DEFAULT_FILE_KIND;
  if (!FILE_KIND_PATTERN.test(kind)) return err("files.invalid_input");
  const contentType = normalizeContentType(input.contentType ?? DEFAULT_CONTENT_TYPE);
  if (contentType === null) return err("files.invalid_input");
  const expiresAt = resolveExpiry(input, now, defaultTtlSeconds);
  if (expiresAt === false) return err("files.invalid_input");
  return ok({
    originalName: sanitizeFileName(input.name),
    contentType,
    kind,
    expiresAt,
  });
}

/** The expiry from `expiresAt`, `ttlSeconds` or the default; false when the input is contradictory or in the past. */
function resolveExpiry(input: SaveFileFields, now: Date, defaultTtlSeconds: number | null): Date | null | false {
  if (input.expiresAt !== undefined && input.ttlSeconds !== undefined) return false;
  if (input.expiresAt !== undefined) {
    return Number.isNaN(input.expiresAt.getTime()) || input.expiresAt.getTime() <= now.getTime() ? false : input.expiresAt;
  }
  const ttlSeconds = input.ttlSeconds ?? defaultTtlSeconds;
  if (ttlSeconds === null) return null;
  return Number.isSafeInteger(ttlSeconds) && ttlSeconds > 0 ? new Date(now.getTime() + ttlSeconds * 1000) : false;
}

/** Deletes a blob after a refused or failed save; a failure here is logged, the row (if any) decides the rest. */
async function deleteBlobQuietly(storage: FileStorage, key: string): Promise<void> {
  try {
    await storage.delete(key);
  } catch (error) {
    console.error(`@softure-ai/files: deleting the blob of a refused save failed: ${errorLogLabel(error)}`);
  }
}
