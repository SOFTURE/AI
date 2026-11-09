// The nightly off-site copy: each file is encrypted to the recipient into a temporary file next to it (0600),
// hashed, PUT under the prefix and removed again. Nothing remote is ever listed, read or deleted, so a write-only
// token is enough. The result is a run record with safe error codes; secrets never reach its message.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { BackupErrorCode, BackupObject, BackupResult } from "../contract.js";
import type { UploadConfig } from "./config.js";
import { encryptFile } from "./crypto.js";
import { buildObjectKey, parseBackupFileName } from "./objects.js";
import { putObjectFile, S3RequestError, type S3Options } from "./s3.js";

export interface RunRecord {
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly result: BackupResult;
  readonly objects: readonly BackupObject[];
  readonly sizeBytes: number;
  readonly error: { readonly code: BackupErrorCode; readonly message: string } | null;
}

export interface UploadOptions {
  readonly config: UploadConfig;
  /** Local backup files: the run's dump, and its data archive when there is one. */
  readonly files: readonly string[];
  readonly now?: () => Date;
  readonly s3?: S3Options;
  /** Called after each uploaded object (for a log line). */
  readonly onUploaded?: (object: BackupObject) => void;
}

class UploadFailure extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** sha256 (hex) and size of a file, streamed. */
export async function hashFile(path: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return { sha256: hash.digest("hex"), bytes: statSync(path).size };
}

function describeS3Error(error: unknown, key: string): UploadFailure {
  if (error instanceof S3RequestError) {
    if (error.isDenied) return new UploadFailure("upload_denied", `the store refused ${key}: ${error.message}`);
    if (error.status === null) return new UploadFailure("network_error", error.message);
    return new UploadFailure("upload_failed", error.message);
  }
  return new UploadFailure("upload_failed", `uploading ${key} failed (${error instanceof Error ? error.message : String(error)})`);
}

async function uploadFile(config: UploadConfig, path: string, options: UploadOptions): Promise<BackupObject> {
  const name = basename(path);
  const parsed = parseBackupFileName(name);
  if (parsed === null) throw new UploadFailure("file_missing", `${name} is not a backup file name (db-<time>.dump or data-<time>.tar.gz)`);
  if (!existsSync(path) || !statSync(path).isFile()) throw new UploadFailure("file_missing", `${name} is not in ${dirname(path)}`);
  const encrypted = join(dirname(path), `.offsite-${String(process.pid)}-${name}.age`);
  try {
    try {
      await encryptFile(path, encrypted, config.recipient);
    } catch (error) {
      throw new UploadFailure("encrypt_failed", `encrypting ${name} failed (${error instanceof Error ? error.message : String(error)})`);
    }
    const { sha256, bytes } = await hashFile(encrypted);
    const key = buildObjectKey(config.store.prefix, name);
    try {
      await putObjectFile(config.store, { key, path: encrypted, bytes, sha256 }, options.s3);
    } catch (error) {
      throw describeS3Error(error, key);
    }
    return { kind: parsed.kind, key, bytes, sha256 };
  } finally {
    rmSync(encrypted, { force: true });
  }
}

/** Uploads every file in order; the first failure ends the run (already uploaded objects stay listed). */
export async function uploadBackups(options: UploadOptions): Promise<RunRecord> {
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const objects: BackupObject[] = [];
  let error: RunRecord["error"] = null;
  for (const file of options.files) {
    try {
      const object = await uploadFile(options.config, file, options);
      objects.push(object);
      options.onUploaded?.(object);
    } catch (caught) {
      error =
        caught instanceof UploadFailure
          ? { code: caught.code, message: caught.message }
          : { code: "upload_failed", message: caught instanceof Error ? caught.message : String(caught) };
      break;
    }
  }
  if (options.files.length === 0) error = { code: "file_missing", message: "no backup file was given" };
  return {
    startedAt,
    finishedAt: now(),
    result: error === null ? "ok" : "failed",
    objects,
    sizeBytes: objects.reduce((sum, object) => sum + object.bytes, 0),
    error,
  };
}

/** A run that did nothing because the host has no off-site configuration. */
export function buildNotConfiguredRecord(now: Date): RunRecord {
  return { startedAt: now, finishedAt: now, result: "not_configured", objects: [], sizeBytes: 0, error: null };
}
