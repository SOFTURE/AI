// `pg_dump` before a deploy, with retention: `<prefix>-<UTC timestamp>.dump` files in one folder, the newest
// `keep` of a prefix stay, and with `maxAgeDays` none older than that (a privacy promise: deleted data must not live
// on in backups, FIRE_TRACKER's 30 days). Retention runs only after a dump succeeded, so a failing deploy never loses a
// backup, and the newest dump is never removed.
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export interface BackupOptions {
  readonly dir: string;
  readonly prefix: string;
  readonly keep: number;
  /** Dumps of the prefix older than this many days are removed too; null keeps them (count only). */
  readonly maxAgeDays?: number | null;
  /** Tables whose rows stay out of the dump (their definition stays), e.g. a table of IP addresses. */
  readonly excludeTableData?: readonly string[];
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

/** The first bytes of every `pg_dump --format=custom` file. */
const CUSTOM_FORMAT_MAGIC = "PGDMP";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `db-20261005T180102Z.dump`: sorts by time as a string. */
export function formatBackupName(prefix: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${prefix}-${stamp}.dump`;
}

export function isBackupName(prefix: string, fileName: string): boolean {
  if (!fileName.startsWith(`${prefix}-`) || !fileName.endsWith(".dump")) return false;
  return TIMESTAMP.test(fileName.slice(prefix.length + 1, -".dump".length));
}

/** The time in a backup name (`db-20261005T180102Z.dump` → 2026-10-05T18:01:02Z). */
export function readBackupTime(prefix: string, fileName: string): Date {
  const stamp = fileName.slice(prefix.length + 1, -".dump".length);
  return new Date(stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z"));
}

/** The backups of `prefix` beyond the newest `keep`, oldest last; other files are never listed. */
export function selectExpiredBackups(fileNames: readonly string[], prefix: string, keep: number): string[] {
  return fileNames
    .filter((name) => isBackupName(prefix, name))
    .sort()
    .reverse()
    .slice(keep);
}

/**
 * The backups of `prefix` older than `now` minus `maxAgeDays` (one exactly that old stays), oldest last. The newest
 * backup is never listed, so a long pause between releases cannot leave the folder empty.
 */
export function selectAgedBackups(fileNames: readonly string[], prefix: string, maxAgeDays: number, now: Date): string[] {
  const oldestKept = now.getTime() - maxAgeDays * DAY_MS;
  return fileNames
    .filter((name) => isBackupName(prefix, name))
    .sort()
    .reverse()
    .slice(1)
    .filter((name) => readBackupTime(prefix, name).getTime() < oldestKept);
}

/** Whether `path` starts with the custom format's header, so a truncated or foreign file is never kept as a backup. */
export function hasCustomFormatHeader(path: string): boolean {
  const fd = openSync(path, "r");
  try {
    const header = Buffer.alloc(CUSTOM_FORMAT_MAGIC.length);
    const read = readSync(fd, header, 0, header.length, 0);
    return read === header.length && header.toString("latin1") === CUSTOM_FORMAT_MAGIC;
  } finally {
    closeSync(fd);
  }
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
  if (!hasCustomFormatHeader(temporary)) {
    rmSync(temporary, { force: true });
    return { ok: false, problem: `${options.pgDump} wrote no pg_dump custom-format file (no PGDMP header)` };
  }
  renameSync(temporary, path);
  const names = readdirSync(options.dir);
  const maxAgeDays = options.maxAgeDays ?? null;
  const aged = maxAgeDays === null ? [] : selectAgedBackups(names, options.prefix, maxAgeDays, options.now);
  const removed = [...new Set([...selectExpiredBackups(names, options.prefix, options.keep), ...aged])].sort().reverse();
  for (const name of removed) rmSync(join(options.dir, name));
  return { ok: true, file: path, bytes: statSync(path).size, removed };
}

type DumpResult = { ok: true } | { ok: false; problem: string };

function runPgDump(options: BackupOptions, fd: number): Promise<DumpResult> {
  return new Promise((resolve) => {
    const exclusions = (options.excludeTableData ?? []).map((table) => `--exclude-table-data=${table}`);
    const child = spawn(options.pgDump, ["--format=custom", "--no-password", ...exclusions], {
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
