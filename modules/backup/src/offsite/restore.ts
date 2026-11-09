// Restore and fetch from the off-site copy. Restore puts a database dump into a NEW database by default, never
// silently over the one in production: overwriting an existing database needs `overwrite` (pg_restore --clean
// --if-exists). Fetch decrypts any object (a data archive) to a local file.
import type { StoreConfig } from "./config.js";
import { decryptStream, writeStreamToFile } from "./crypto.js";
import { parseObjectKey, selectNewestKey } from "./objects.js";
import {
  createDatabase,
  createRestoreDatabaseName,
  databaseExists,
  getUrlDatabase,
  isDatabaseName,
  runPgRestore,
} from "./postgres.js";
import { getObjectStream, listObjects, type S3Options } from "./s3.js";
import type { BackupKind } from "../contract.js";

export type OffsiteResult<T> = { ok: true; value: T } | { ok: false; problem: string };

/** The key to read: the one named (checked to be a backup of `kind` under the prefix), else the newest of `kind`. */
export async function resolveKey(store: StoreConfig, kind: BackupKind, key: string | undefined, s3?: S3Options): Promise<OffsiteResult<{ key: string; takenAt: Date }>> {
  if (key !== undefined) {
    const parsed = parseObjectKey(store.prefix, key);
    if (parsed?.kind !== kind) return { ok: false, problem: `${key} is not a ${kind} backup under ${store.prefix}/` };
    return { ok: true, value: { key, takenAt: parsed.takenAt } };
  }
  const objects = await listObjects(store, `${store.prefix}/`, s3);
  const newest = selectNewestKey(store.prefix, objects.map((object) => object.key), kind);
  if (newest === null) return { ok: false, problem: `no ${kind} backup is stored under ${store.prefix}/` };
  return { ok: true, value: newest };
}

export interface RestoreOptions {
  readonly store: StoreConfig;
  readonly identities: readonly string[];
  /** A superuser's URL on the target server (any database of it). */
  readonly adminUrl: string;
  /** An object key; the newest database backup by default. */
  readonly key?: string;
  /** The database to restore into; a new `<url database>_restore_<time>` by default. */
  readonly into?: string;
  /** Restore over an existing `into` (pg_restore --clean --if-exists). */
  readonly overwrite?: boolean;
  /** Leave out ownership and grants, for a server without the app's roles. */
  readonly noOwner?: boolean;
  readonly pgRestore: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly now?: Date;
  readonly s3?: S3Options;
}

export interface RestoreOutcome {
  readonly key: string;
  readonly database: string;
  readonly created: boolean;
}

export async function restoreBackup(options: RestoreOptions): Promise<OffsiteResult<RestoreOutcome>> {
  const resolved = await resolveKey(options.store, "database", options.key, options.s3);
  if (!resolved.ok) return resolved;
  const target = options.into ?? createRestoreDatabaseName(getUrlDatabase(options.adminUrl), options.now ?? new Date());
  if (!isDatabaseName(target)) return { ok: false, problem: `${target} is not a database name (lower-case letters, digits and _)` };
  const exists = await databaseExists(options.adminUrl, target);
  if (exists && options.overwrite !== true) {
    return { ok: false, problem: `the database ${target} exists; pass --overwrite to restore over it, or restore into a new one` };
  }
  if (!exists && options.overwrite === true) return { ok: false, problem: `--overwrite needs an existing database; ${target} does not exist` };
  // Decrypt before creating anything: a wrong key fails here, at the header.
  const encrypted = await getObjectStream(options.store, resolved.value.key, options.s3);
  let dump: ReadableStream<Uint8Array>;
  try {
    dump = await decryptStream(encrypted, options.identities);
  } catch (error) {
    await encrypted.cancel().catch(() => undefined);
    return { ok: false, problem: `cannot decrypt ${resolved.value.key} with this identity (${error instanceof Error ? error.message : String(error)})` };
  }
  if (!exists) await createDatabase(options.adminUrl, target);
  const flags = [...(options.overwrite === true ? ["--clean", "--if-exists"] : []), ...(options.noOwner === true ? ["--no-owner", "--no-acl"] : [])];
  const restored = await runPgRestore({ adminUrl: options.adminUrl, database: target, flags, dump, pgRestore: options.pgRestore, env: options.env });
  if (!restored.ok) return { ok: false, problem: `${resolved.value.key} did not restore into ${target}: ${restored.problem}` };
  return { ok: true, value: { key: resolved.value.key, database: target, created: !exists } };
}

export interface FetchOptions {
  readonly store: StoreConfig;
  readonly identities: readonly string[];
  readonly kind: BackupKind;
  readonly key?: string;
  /** The decrypted file to write (0600). */
  readonly out: string;
  readonly s3?: S3Options;
}

/** Downloads and decrypts one object to a file, e.g. a data archive to unpack into the new volume. */
export async function fetchBackup(options: FetchOptions): Promise<OffsiteResult<{ key: string; out: string }>> {
  const resolved = await resolveKey(options.store, options.kind, options.key, options.s3);
  if (!resolved.ok) return resolved;
  const encrypted = await getObjectStream(options.store, resolved.value.key, options.s3);
  let plain: ReadableStream<Uint8Array>;
  try {
    plain = await decryptStream(encrypted, options.identities);
  } catch (error) {
    await encrypted.cancel().catch(() => undefined);
    return { ok: false, problem: `cannot decrypt ${resolved.value.key} with this identity (${error instanceof Error ? error.message : String(error)})` };
  }
  await writeStreamToFile(plain, options.out);
  return { ok: true, value: { key: resolved.value.key, out: options.out } };
}
