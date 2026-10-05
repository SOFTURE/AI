// `pg_dump` before a deploy, with retention: `<prefix>-<UTC timestamp>.dump` files in one folder, the newest
// `keep` of a prefix stay. Retention runs only after a dump succeeded, so a failing deploy never loses a backup.
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export interface BackupOptions {
  readonly dir: string;
  readonly prefix: string;
  readonly keep: number;
  /** libpq variables for the database (from `toLibpqEnv`). */
  readonly libpqEnv: Readonly<Record<string, string>>;
  /** The `pg_dump` executable: a name on `PATH` or a path. */
  readonly pgDump: string;
  readonly now: Date;
  /** The rest of the environment `pg_dump` runs with (`PATH`, `HOME`). */
  readonly env: Readonly<Record<string, string | undefined>>;
}

export type BackupResult =
  | { ok: true; file: string; bytes: number; removed: string[] }
  | { ok: false; problem: string };

/** A prefix is a short lower-case word, so it can never match another app's or a user's files. */
export const BACKUP_PREFIX = /^[a-z0-9][a-z0-9_-]*$/;
const TIMESTAMP = /^\d{8}T\d{6}Z$/;
/** Owner read and write only: the dump holds every row of production. */
const BACKUP_FILE_MODE = 0o600;

/** `db-20261005T180102Z.dump`: sorts by time as a string. */
export function formatBackupName(prefix: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${prefix}-${stamp}.dump`;
}

export function isBackupName(prefix: string, fileName: string): boolean {
  if (!fileName.startsWith(`${prefix}-`) || !fileName.endsWith(".dump")) return false;
  return TIMESTAMP.test(fileName.slice(prefix.length + 1, -".dump".length));
}

/** The backups of `prefix` beyond the newest `keep`, oldest last; other files are never listed. */
export function selectExpiredBackups(fileNames: readonly string[], prefix: string, keep: number): string[] {
  return fileNames
    .filter((name) => isBackupName(prefix, name))
    .sort()
    .reverse()
    .slice(keep);
}

/** Dumps the database in the custom format (`pg_restore` reads it), then applies retention. */
export async function createBackup(options: BackupOptions): Promise<BackupResult> {
  mkdirSync(options.dir, { recursive: true });
  const fileName = formatBackupName(options.prefix, options.now);
  const path = join(options.dir, fileName);
  if (existsSync(path)) {
    return { ok: false, problem: `${fileName} already exists; wait a second and run the backup again` };
  }
  const temporary = join(options.dir, `.${fileName}.${process.pid}.tmp`);
  rmSync(temporary, { force: true });
  // Opened before pg_dump runs, with `wx` and mode 0600, so the dump is never readable by others while it grows.
  const fd = openSync(temporary, "wx", BACKUP_FILE_MODE);
  let dump: DumpResult;
  try {
    dump = await runPgDump(options, fd);
  } finally {
    closeSync(fd);
  }
  if (!dump.ok) {
    rmSync(temporary, { force: true });
    return dump;
  }
  renameSync(temporary, path);
  const removed = selectExpiredBackups(readdirSync(options.dir), options.prefix, options.keep);
  for (const name of removed) rmSync(join(options.dir, name));
  return { ok: true, file: path, bytes: statSync(path).size, removed };
}

type DumpResult = { ok: true } | { ok: false; problem: string };

function runPgDump(options: BackupOptions, fd: number): Promise<DumpResult> {
  return new Promise((resolve) => {
    const child = spawn(options.pgDump, ["--format=custom", "--no-password"], {
      env: { ...pickProcessEnv(options.env), ...options.libpqEnv },
      stdio: ["ignore", fd, "pipe"],
    });
    let stderr = "";
    // stdio[2] is "pipe", so the stream exists; null would be a bug in the options above.
    if (child.stderr === null) throw new Error("runPgDump: pg_dump has no stderr pipe");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      const reason = error.code === "ENOENT" ? "not found; install the PostgreSQL client or pass --pg-dump=<path>" : error.message;
      resolve({ ok: false, problem: `${options.pgDump} ${reason}` });
    });
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      const lastLine = stderr.trim().split("\n").at(-1) ?? "";
      const exit = signal === null ? `exit code ${String(code)}` : `signal ${signal}`;
      resolve({ ok: false, problem: `pg_dump failed (${exit})${lastLine === "" ? "" : `: ${lastLine}`}` });
    });
  });
}

/**
 * Only what pg_dump needs from the caller's environment; every `PG*` variable comes from the URL, so a stray
 * `PGDATABASE` in the shell can never point the dump at another database.
 */
function pickProcessEnv(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of ["PATH", "HOME", "LANG", "LC_ALL", "TZ"]) {
    const value = env[name];
    if (value !== undefined) picked[name] = value;
  }
  return picked;
}
