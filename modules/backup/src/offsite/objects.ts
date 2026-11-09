// Object names: `<prefix>/<the local file name>.age`. Only the deploy's own backup names are accepted, so a key
// sorts by time and nothing else can be uploaded by mistake. Retention is the bucket's lifecycle rule on the prefix;
// this package never deletes an object.
import type { BackupKind } from "../contract.js";

/** `db-20261109T031700Z.dump` (`@softure-ai/deploy` backup, any short prefix). */
const DATABASE_NAME = /^([a-z0-9][a-z0-9_-]*)-(\d{8})T(\d{6})Z\.dump$/;
/** `data-20261109-031700.tar.gz` (deploy.sh backup-data). */
const DATA_NAME = /^data-(\d{8})-(\d{6})\.tar\.gz$/;
export const OBJECT_SUFFIX = ".age";

export interface BackupFileName {
  readonly kind: BackupKind;
  readonly name: string;
  /** The time in the name, UTC. */
  readonly takenAt: Date;
}

function toDate(day: string, time: string): Date {
  return new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`);
}

/** The kind and time of a backup file name, or null for any other name (or an impossible date). */
export function parseBackupFileName(name: string): BackupFileName | null {
  const data = DATA_NAME.exec(name);
  const database = data === null ? DATABASE_NAME.exec(name) : null;
  if (data === null && database === null) return null;
  const takenAt = data === null ? toDate(database?.[2] ?? "", database?.[3] ?? "") : toDate(data[1] ?? "", data[2] ?? "");
  if (Number.isNaN(takenAt.getTime())) return null;
  return { kind: data === null ? "database" : "data", name, takenAt };
}

export function buildObjectKey(prefix: string, fileName: string): string {
  return `${prefix}/${fileName}${OBJECT_SUFFIX}`;
}

/** The backup file name of a key under `prefix`, or null for any other key. */
export function parseObjectKey(prefix: string, key: string): BackupFileName | null {
  if (!key.startsWith(`${prefix}/`) || !key.endsWith(OBJECT_SUFFIX)) return null;
  const name = key.slice(prefix.length + 1, -OBJECT_SUFFIX.length);
  if (name.includes("/")) return null;
  return parseBackupFileName(name);
}

/** The newest key of `kind` under `prefix`, by the time in its name; null when there is none. */
export function selectNewestKey(prefix: string, keys: readonly string[], kind: BackupKind): { key: string; takenAt: Date } | null {
  let newest: { key: string; takenAt: Date } | null = null;
  for (const key of keys) {
    const parsed = parseObjectKey(prefix, key);
    if (parsed?.kind !== kind) continue;
    if (newest === null || parsed.takenAt.getTime() > newest.takenAt.getTime()) newest = { key, takenAt: parsed.takenAt };
  }
  return newest;
}
