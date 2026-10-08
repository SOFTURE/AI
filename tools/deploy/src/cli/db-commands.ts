import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_APP_LEDGER } from "../db/app-ledger.js";
import { createBackup, importBackup, BACKUP_PREFIX } from "../db/backup.js";
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
import { buildLedgerSql, buildRowCountsSql, parseLedgerOutput, parseRowCountsOutput } from "../db/ledger-sql.js";
import { checkSchema, guardSchema, type SchemaGuardResult } from "../db/schema-guard.js";
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

/** The text of `path` (relative to the working directory), or of stdin for `-`; a missing file stops the command. */
async function readInputFile(command: string, io: CliIo, path: string): Promise<string> {
  if (path === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of io.stdin ?? process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return Buffer.concat(chunks).toString("utf8");
  }
  try {
    return readFileSync(resolve(io.cwd, path), "utf8");
  } catch (error) {
    return fail(`${command}: cannot read ${path} (${(error as NodeJS.ErrnoException).code ?? "unknown error"}).`);
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
    "pg-dump": { type: "string" },
    "max-age-days": { type: "string" },
    "exclude-table-data": { type: "string" },
    "from-file": { type: "string" },
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
  const fromFile = flags["from-file"];
  if (fromFile !== undefined && (flags["pg-dump"] !== undefined || flags["exclude-table-data"] !== undefined)) {
    fail("backup: --from-file takes a finished dump; pass --pg-dump and --exclude-table-data to the pg_dump that wrote it.", USAGE_EXIT_CODE);
  }
  const result =
    fromFile === undefined
      ? await dumpDatabase(io, { ...flags, keep, maxAgeDays, excludeTableData })
      : importBackup({ source: resolve(io.cwd, fromFile), dir: resolve(io.cwd, flags.dir), prefix: flags.prefix, keep, maxAgeDays, now: new Date() });
  if (!result.ok) fail(`backup: no backup written; ${result.problem}.`);
  const removed = result.removed.length === 0 ? "" : `; removed ${result.removed.length} older: ${result.removed.join(", ")}`;
  io.stdout(`backup: wrote ${result.file} (${result.bytes} bytes)${removed}\n`);
}

interface DumpOptions {
  dir: string;
  prefix: string;
  keep: number;
  maxAgeDays: number | null;
  excludeTableData: string[];
  "url-env": string;
  "pg-dump"?: string | undefined;
}

async function dumpDatabase(io: CliIo, options: DumpOptions): ReturnType<typeof createBackup> {
  const libpq = toLibpqEnv(readDatabaseUrl("backup", io.env, options["url-env"]));
  if (!libpq.ok) fail(`backup: ${options["url-env"]}: ${libpq.problem}.`);
  return createBackup({
    dir: resolve(io.cwd, options.dir),
    prefix: options.prefix,
    keep: options.keep,
    maxAgeDays: options.maxAgeDays,
    excludeTableData: options.excludeTableData,
    libpqEnv: libpq.env,
    pgDump: options["pg-dump"] ?? "pg_dump",
    now: new Date(),
    env: io.env,
  });
}

/** `--app-ledger`, a table name `quoteTableName` takes; a usage error otherwise. */
function readAppLedgerName(command: string, value: string): string {
  const list = parseTableList(value);
  if (!list.ok || list.tables.length !== 1) fail(`${command}: --app-ledger must be one table, schema.table in lower snake case, got "${value}".`, USAGE_EXIT_CODE);
  return list.tables[0] ?? value;
}

function formatSchemaGuardOutput(check: Extract<SchemaGuardResult, { ok: true }>["check"]): string {
  const lines: string[] = [];
  let pending = 0;
  if (check.softure !== null) {
    pending += check.softure.pending.length;
    lines.push(...check.softure.pending.map((step) => `  pending ${step.module} ${String(step.version).padStart(4, "0")}_${step.name}.sql`));
    if (check.softure.absent.length > 0) lines.push(`  not in the image (left as they are): ${check.softure.absent.join(", ")}`);
  }
  if (check.app !== null) {
    pending += check.app.pending.length;
    lines.push(...check.app.pending.map((entry) => `  pending app ${entry.tag}.sql`));
    if (check.app.changed.length > 0) {
      lines.push(`  note: applied app migrations changed since they ran (drizzle does not run them again): ${check.app.changed.map((entry) => entry.tag).join(", ")}`);
    }
  }
  const summary = pending === 0 ? "nothing to apply" : `${pending} migration(s) to apply`;
  return `schema-guard: ok, ${summary}\n${lines.map((line) => `${line}\n`).join("")}`;
}

/**
 * `softure-deploy schema-guard [--migrations-dir=<dir>] [--app-migrations-dir=<dir>]`: refuses an image the ledgers
 * cannot take; writes nothing. `--ledger-file` reads the ledgers from psql's output of `--print-sql` instead of
 * `DATABASE_URL`.
 */
export async function runSchemaGuard(args: string[], io: CliIo): Promise<void> {
  const flags = readFlags("schema-guard", args, {
    "migrations-dir": { type: "string" },
    "app-migrations-dir": { type: "string" },
    "app-ledger": { type: "string" },
    "ledger-file": { type: "string" },
    "print-sql": { type: "boolean", default: false },
    "url-env": { type: "string", default: DEFAULT_URL_ENV },
  });
  const appLedger = readAppLedgerName("schema-guard", flags["app-ledger"] ?? DEFAULT_APP_LEDGER);
  const withApp = flags["app-migrations-dir"] !== undefined || flags["app-ledger"] !== undefined;
  if (flags["print-sql"]) {
    if (flags["ledger-file"] !== undefined) fail("schema-guard: pass either --print-sql or --ledger-file, not both.", USAGE_EXIT_CODE);
    io.stdout(buildLedgerSql(withApp ? appLedger : null));
    return;
  }
  const migrationsDir = flags["migrations-dir"] === undefined ? null : resolve(io.cwd, flags["migrations-dir"]);
  const appMigrationsDir = flags["app-migrations-dir"] === undefined ? null : resolve(io.cwd, flags["app-migrations-dir"]);
  if (migrationsDir === null && appMigrationsDir === null) {
    fail(
      "schema-guard: --migrations-dir (the folder of `softure migrate --export-migrations`) or --app-migrations-dir (the app's drizzle folder) is required.",
      USAGE_EXIT_CODE,
    );
  }
  let result: SchemaGuardResult;
  if (flags["ledger-file"] === undefined) {
    const url = readDatabaseUrl("schema-guard", io.env, flags["url-env"]);
    result = await runOnDatabase("schema-guard", url, (client) => guardSchema(client, { migrationsDir, appMigrationsDir, appLedger }));
  } else {
    const shown = flags["ledger-file"] === "-" ? "stdin" : flags["ledger-file"];
    const output = parseLedgerOutput(await readInputFile("schema-guard", io, flags["ledger-file"]));
    if (!output.ok) return fail(`schema-guard: ${shown}: ${output.problem}.`);
    if (appMigrationsDir !== null && output.value.app === null) {
      fail(`schema-guard: ${shown} holds no app ledger; print the SQL with --app-ledger or --app-migrations-dir.`);
    }
    result = await checkSchema({ migrationsDir, journal: output.value.softure, appMigrationsDir, appRows: output.value.app ?? [] });
  }
  if (!result.ok) {
    fail(`schema-guard: the database cannot take this image's migrations:\n${result.problems.map((line) => `  ${line}`).join("\n")}`);
  }
  io.stdout(formatSchemaGuardOutput(result.check));
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

function countOnDatabase(io: CliIo, urlEnv: string, tables: string[]): Promise<RowCounts> {
  const url = readDatabaseUrl("row-counts", io.env, urlEnv);
  return runOnDatabase("row-counts", url, (client) => countRows(client, tables));
}

async function readCountsOutput(io: CliIo, path: string, tables: string[]): Promise<RowCounts> {
  const output = parseRowCountsOutput(await readInputFile("row-counts", io, path), tables);
  if (!output.ok) fail(`row-counts: ${path === "-" ? "stdin" : path}: ${output.problem}.`);
  return output.value;
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
    "counts-file": { type: "string" },
    "print-sql": { type: "boolean", default: false },
    "url-env": { type: "string", default: DEFAULT_URL_ENV },
  });
  const tables = readRowCountTables(flags, io.cwd);
  if (flags["print-sql"]) {
    if (flags["counts-file"] !== undefined || flags.out !== undefined || flags.compare !== undefined) {
      fail("row-counts: --print-sql takes only the table list (--tables or --config).", USAGE_EXIT_CODE);
    }
    io.stdout(buildRowCountsSql(tables));
    return;
  }
  const before = flags.compare === undefined ? null : readRowCountsFile(resolve(io.cwd, flags.compare), flags.compare);
  const counts = flags["counts-file"] === undefined ? await countOnDatabase(io, flags["url-env"], tables) : await readCountsOutput(io, flags["counts-file"], tables);
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
