import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createBackup, BACKUP_PREFIX } from "../db/backup.js";
import { DEFAULT_URL_ENV, isPostgresUrl, toLibpqEnv, withPgClient } from "../db/connection.js";
import {
  compareRowCounts,
  countRows,
  formatRowCountChange,
  formatRowCountLoss,
  parseTableList,
  rowCountsFileSchema,
  type RowCounts,
} from "../db/row-counts.js";
import { guardSchema } from "../db/schema-guard.js";
import { DEFAULT_DEPLOY_CONFIG, readDeployConfig } from "./deploy-config.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags } from "./options.js";

export const DEFAULT_BACKUP_DIR = "backups";
export const DEFAULT_BACKUP_PREFIX = "db";
export const DEFAULT_BACKUP_KEEP = 7;

/** The database URL from the variable `--url-env` names; the URL itself is never printed. */
function readDatabaseUrl(command: string, env: CliIo["env"], name: string): string {
  const url = env[name];
  if (url === undefined || url === "") fail(`${command}: ${name} is not set; it must hold the database URL.`);
  if (!isPostgresUrl(url)) fail(`${command}: ${name} must be a postgres:// or postgresql:// URL.`);
  return url;
}

/** Runs a database step; a driver error prints its message only (pg messages carry no password). */
async function runOnDatabase<T>(command: string, url: string, run: Parameters<typeof withPgClient<T>>[1]): Promise<T> {
  try {
    return await withPgClient(url, run);
  } catch (error) {
    return fail(`${command}: the database refused the step: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** A whole number of at least 1, or a usage error naming the flag. */
function readCount(command: string, flag: string, value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) fail(`${command}: --${flag} must be a whole number of at least 1, got "${value}".`, USAGE_EXIT_CODE);
  return count;
}

/**
 * `softure-deploy backup`: a pg_dump into `--dir`, then the newest `--keep` dumps of `--prefix` stay and, with
 * `--max-age-days`, none older; `--exclude-table-data` leaves the rows of those tables out.
 */
export async function runBackup(args: string[], io: CliIo): Promise<void> {
  const flags = readFlags("backup", args, {
    dir: { type: "string", default: DEFAULT_BACKUP_DIR },
    prefix: { type: "string", default: DEFAULT_BACKUP_PREFIX },
    keep: { type: "string", default: String(DEFAULT_BACKUP_KEEP) },
    "url-env": { type: "string", default: DEFAULT_URL_ENV },
    "pg-dump": { type: "string", default: "pg_dump" },
    "max-age-days": { type: "string" },
    "exclude-table-data": { type: "string" },
  });
  const keep = readCount("backup", "keep", flags.keep);
  const maxAgeDays = flags["max-age-days"] === undefined ? null : readCount("backup", "max-age-days", flags["max-age-days"]);
  let excludeTableData: string[] = [];
  if (flags["exclude-table-data"] !== undefined) {
    const list = parseTableList(flags["exclude-table-data"]);
    if (!list.ok) fail(`backup: --exclude-table-data: ${list.problem}.`, USAGE_EXIT_CODE);
    excludeTableData = list.tables;
  }
  if (!BACKUP_PREFIX.test(flags.prefix)) {
    fail(`backup: --prefix must be lower case letters, digits, - and _, got "${flags.prefix}".`, USAGE_EXIT_CODE);
  }
  const libpq = toLibpqEnv(readDatabaseUrl("backup", io.env, flags["url-env"]));
  if (!libpq.ok) fail(`backup: ${flags["url-env"]}: ${libpq.problem}.`);
  const result = await createBackup({
    dir: resolve(io.cwd, flags.dir),
    prefix: flags.prefix,
    keep,
    maxAgeDays,
    excludeTableData,
    libpqEnv: libpq.env,
    pgDump: flags["pg-dump"],
    now: new Date(),
    env: io.env,
  });
  if (!result.ok) fail(`backup: no backup written; ${result.problem}.`);
  const removed = result.removed.length === 0 ? "" : `; removed ${result.removed.length} older: ${result.removed.join(", ")}`;
  io.stdout(`backup: wrote ${result.file} (${result.bytes} bytes)${removed}\n`);
}

/** `softure-deploy schema-guard --migrations-dir=<dir>`: refuses an image the ledger cannot take; writes nothing. */
export async function runSchemaGuard(args: string[], io: CliIo): Promise<void> {
  const flags = readFlags("schema-guard", args, {
    "migrations-dir": { type: "string" },
    "url-env": { type: "string", default: DEFAULT_URL_ENV },
  });
  const dir = flags["migrations-dir"];
  if (dir === undefined) fail("schema-guard: --migrations-dir is required (the folder of `softure migrate --export-migrations`).", USAGE_EXIT_CODE);
  const url = readDatabaseUrl("schema-guard", io.env, flags["url-env"]);
  const result = await runOnDatabase("schema-guard", url, (client) => guardSchema(client, resolve(io.cwd, dir)));
  if (!result.ok) {
    fail(`schema-guard: the database cannot take this image's migrations:\n${result.problems.map((line) => `  ${line}`).join("\n")}`);
  }
  const lines = result.check.pending.map((step) => `  pending ${step.module} ${String(step.version).padStart(4, "0")}_${step.name}.sql`);
  if (result.check.absent.length > 0) {
    lines.push(`  not in the image (left as they are): ${result.check.absent.join(", ")}`);
  }
  const summary = result.check.pending.length === 0 ? "nothing to apply" : `${result.check.pending.length} migration(s) to apply`;
  io.stdout(`schema-guard: ok, ${summary}\n${lines.map((line) => `${line}\n`).join("")}`);
}

function readRowCountsFile(path: string, shown: string): RowCounts {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    return fail(`row-counts: cannot read ${shown} (${(error as NodeJS.ErrnoException).code ?? "unknown error"}).`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(`row-counts: ${shown} is not JSON.`);
  }
  const parsed = rowCountsFileSchema.safeParse(json);
  if (!parsed.success) fail(`row-counts: ${shown} is not a row-counts file: ${parsed.error.issues[0]?.message ?? "invalid"}.`);
  return parsed.data.counts;
}

const TABLES_HINT = "pass --tables=users,billing.subscriptions or list them in database.rowCountTables of";

/** The tables to count: `--tables`, else `database.rowCountTables` of the `--config` file (default `deploy.json`). */
function readRowCountTables(flags: { tables?: string | undefined; config?: string | undefined }, cwd: string): string[] {
  if (flags.tables !== undefined) {
    if (flags.config !== undefined) fail("row-counts: pass either --tables or --config, not both.", USAGE_EXIT_CODE);
    const list = parseTableList(flags.tables);
    if (!list.ok) fail(`row-counts: ${list.problem}.`, USAGE_EXIT_CODE);
    return list.tables;
  }
  const shown = flags.config ?? DEFAULT_DEPLOY_CONFIG;
  const path = resolve(cwd, shown);
  if (flags.config === undefined && !existsSync(path)) {
    fail(`row-counts: no tables to count; ${TABLES_HINT} ${shown} (${shown} not found).`, USAGE_EXIT_CODE);
  }
  const tables = readDeployConfig("row-counts", path, shown).database?.rowCountTables;
  if (tables === undefined) fail(`row-counts: no tables to count; ${TABLES_HINT} ${shown}.`, USAGE_EXIT_CODE);
  return tables;
}

/**
 * `softure-deploy row-counts [--tables=… | --config=deploy.json] [--out=…] [--compare=…]`: counts the app's key
 * tables (one the database lacks is `absent`); with `--compare`, fails when a table has fewer rows than in the
 * earlier file, was not in it, or is absent now. A table absent before and counted now is new and passes.
 */
export async function runRowCounts(args: string[], io: CliIo): Promise<void> {
  const flags = readFlags("row-counts", args, {
    tables: { type: "string" },
    config: { type: "string" },
    out: { type: "string" },
    compare: { type: "string" },
    "url-env": { type: "string", default: DEFAULT_URL_ENV },
  });
  const tables = readRowCountTables(flags, io.cwd);
  const before = flags.compare === undefined ? null : readRowCountsFile(resolve(io.cwd, flags.compare), flags.compare);
  const url = readDatabaseUrl("row-counts", io.env, flags["url-env"]);
  const counts = await runOnDatabase("row-counts", url, (client) => countRows(client, tables));
  if (flags.out !== undefined) {
    const file = { takenAt: new Date().toISOString(), counts };
    writeFileSync(resolve(io.cwd, flags.out), `${JSON.stringify(file, null, 2)}\n`);
  }
  if (before === null) {
    io.stdout(Object.entries(counts).map(([table, count]) => `row-counts: ${table} ${count ?? "absent"}\n`).join(""));
    return;
  }
  const { changes, lost } = compareRowCounts(before, counts);
  io.stdout(changes.map((change) => `row-counts: ${formatRowCountChange(change)}\n`).join(""));
  if (lost.length > 0) {
    fail(`row-counts: the deploy lost rows or tables: ${lost.map(formatRowCountLoss).join(", ")}.`);
  }
}
