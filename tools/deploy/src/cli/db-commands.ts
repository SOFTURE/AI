import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { createBackup, createBackupFromStream, BACKUP_PREFIX, type BackupResult } from "../db/backup.js";
import { DEFAULT_URL_ENV, isPostgresUrl, toLibpqEnv, withPgClient } from "../db/connection.js";
import {
  compareRowCounts,
  formatRowCountChange,
  formatRowCountLoss,
  parseTableList,
  rowCountsFileSchema,
  type RowCounts,
} from "../db/row-counts.js";
import { guardLedgers, readAppJournal, readLedgerSnapshot, type AppJournal } from "../db/schema-guard.js";
import {
  buildLedgerQuery,
  buildRowCountQuery,
  DEFAULT_APP_LEDGER,
  parseLedgerSnapshot,
  parseRowCountSnapshot,
  type LedgerSnapshot,
  type SnapshotResult,
} from "../db/snapshot-query.js";
import { DEFAULT_DEPLOY_CONFIG, readDeployConfig } from "./deploy-config.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import { readInputText, type CliIo } from "./io.js";
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
 * `--max-age-days`, none older; `--exclude-table-data` leaves the rows of those tables out. With `--stdin` the dump is
 * a finished custom-format file on stdin (made by `pg_dump` elsewhere) and only the keeping and the retention run here.
 */
export async function runBackup(args: string[], io: CliIo): Promise<void> {
  const flags = readFlags("backup", args, {
    dir: { type: "string", default: DEFAULT_BACKUP_DIR },
    prefix: { type: "string", default: DEFAULT_BACKUP_PREFIX },
    keep: { type: "string", default: String(DEFAULT_BACKUP_KEEP) },
    "url-env": { type: "string" },
    "pg-dump": { type: "string" },
    "max-age-days": { type: "string" },
    "exclude-table-data": { type: "string" },
    stdin: { type: "boolean", default: false },
  });
  const keep = readCount("backup", "keep", flags.keep);
  const maxAgeDays = flags["max-age-days"] === undefined ? null : readCount("backup", "max-age-days", flags["max-age-days"]);
  if (!BACKUP_PREFIX.test(flags.prefix)) {
    fail(`backup: --prefix must be lower case letters, digits, - and _, got "${flags.prefix}".`, USAGE_EXIT_CODE);
  }
  const target = { dir: resolve(io.cwd, flags.dir), prefix: flags.prefix, keep, maxAgeDays, now: new Date() };
  let result: BackupResult;
  if (flags.stdin) {
    const dumpFlags = (["url-env", "pg-dump", "exclude-table-data"] as const).filter((flag) => flags[flag] !== undefined);
    if (dumpFlags.length > 0) {
      fail(`backup: --stdin takes a finished dump; ${dumpFlags.map((flag) => `--${flag}`).join(", ")} belong to the pg_dump that made it.`, USAGE_EXIT_CODE);
    }
    result = await createBackupFromStream({ ...target, input: io.input ?? Readable.from([]) });
  } else {
    let excludeTableData: string[] = [];
    if (flags["exclude-table-data"] !== undefined) {
      const list = parseTableList(flags["exclude-table-data"]);
      if (!list.ok) fail(`backup: --exclude-table-data: ${list.problem}.`, USAGE_EXIT_CODE);
      excludeTableData = list.tables;
    }
    const urlEnv = flags["url-env"] ?? DEFAULT_URL_ENV;
    const libpq = toLibpqEnv(readDatabaseUrl("backup", io.env, urlEnv));
    if (!libpq.ok) fail(`backup: ${urlEnv}: ${libpq.problem}.`);
    result = await createBackup({ ...target, excludeTableData, libpqEnv: libpq.env, pgDump: flags["pg-dump"] ?? "pg_dump", env: io.env });
  }
  if (!result.ok) fail(`backup: no backup written; ${result.problem}.`);
  const removed = result.removed.length === 0 ? "" : `; removed ${result.removed.length} older: ${result.removed.join(", ")}`;
  io.stdout(`backup: wrote ${result.file} (${result.bytes} bytes)${removed}\n`);
}

/** The snapshot a `--stdin` mode reads, or a failure naming the command. */
async function readSnapshotInput<T>(command: string, io: CliIo, parse: (text: string) => SnapshotResult<T>): Promise<T> {
  const parsed = parse(await readInputText(io));
  if (!parsed.ok) fail(`${command}: ${parsed.problem} on stdin; pipe the output of \`psql -At -c "$(softure-deploy ${command} --print-query …)"\`.`);
  return parsed.value;
}

/**
 * `softure-deploy schema-guard --migrations-dir=<dir> [--app-journal=<file> [--app-ledger=…]] [--stdin]`: refuses an
 * image the ledgers cannot take; writes nothing. `--print-query` prints the snapshot statement `--stdin` reads.
 */
export async function runSchemaGuard(args: string[], io: CliIo): Promise<void> {
  const flags = readFlags("schema-guard", args, {
    "migrations-dir": { type: "string" },
    "app-journal": { type: "string" },
    "app-ledger": { type: "string" },
    "url-env": { type: "string" },
    stdin: { type: "boolean", default: false },
    "print-query": { type: "boolean", default: false },
  });
  const appLedger = readAppLedger(flags);
  if (flags["print-query"]) {
    if (flags.stdin || flags["migrations-dir"] !== undefined || flags["app-journal"] !== undefined || flags["url-env"] !== undefined) {
      fail("schema-guard: --print-query takes only --app-ledger.", USAGE_EXIT_CODE);
    }
    io.stdout(`${buildLedgerQuery({ appLedger })}\n`);
    return;
  }
  if (flags["app-ledger"] !== undefined && flags["app-journal"] === undefined) {
    fail("schema-guard: --app-ledger needs --app-journal (the image's journal of that ledger).", USAGE_EXIT_CODE);
  }
  const dir = flags["migrations-dir"];
  if (dir === undefined) fail("schema-guard: --migrations-dir is required (the folder of `softure migrate --export-migrations`).", USAGE_EXIT_CODE);
  let appJournal: AppJournal | null = null;
  if (flags["app-journal"] !== undefined && appLedger !== null) {
    const journal = readAppJournal(resolve(io.cwd, flags["app-journal"]), appLedger);
    if (!journal.ok) fail(`schema-guard: ${journal.problem}.`);
    appJournal = journal.value;
  }
  let snapshot: LedgerSnapshot;
  if (flags.stdin) {
    if (flags["url-env"] !== undefined) fail("schema-guard: --stdin reads the ledgers from stdin; drop --url-env.", USAGE_EXIT_CODE);
    snapshot = await readSnapshotInput("schema-guard", io, parseLedgerSnapshot);
  } else {
    const url = readDatabaseUrl("schema-guard", io.env, flags["url-env"] ?? DEFAULT_URL_ENV);
    const read = await runOnDatabase("schema-guard", url, (client) => readLedgerSnapshot(client, appLedger));
    if (!read.ok) fail(`schema-guard: ${read.problem}.`);
    snapshot = read.value;
  }
  const result = await guardLedgers({ snapshot, migrationsDir: resolve(io.cwd, dir), appJournal });
  if (!result.ok) {
    fail(`schema-guard: the database cannot take this image's migrations:\n${result.problems.map((line) => `  ${line}`).join("\n")}`);
  }
  const lines = result.check.pending.map((step) => `  pending ${step.module} ${String(step.version).padStart(4, "0")}_${step.name}.sql`);
  if (result.check.absent.length > 0) {
    lines.push(`  not in the image (left as they are): ${result.check.absent.join(", ")}`);
  }
  if (result.app !== null) {
    lines.push(`  ${result.app.ledger}: the image knows ${result.app.imageEntries}, the database ran ${result.app.databaseRows}`);
  }
  const summary = result.check.pending.length === 0 ? "nothing to apply" : `${result.check.pending.length} migration(s) to apply`;
  io.stdout(`schema-guard: ok, ${summary}\n${lines.map((line) => `${line}\n`).join("")}`);
}

/** The app ledger the flags name: `--app-ledger`, else drizzle's with `--app-journal`, else none. */
function readAppLedger(flags: { "app-ledger"?: string | undefined; "app-journal"?: string | undefined }): string | null {
  const ledger = flags["app-ledger"];
  if (ledger !== undefined) {
    const list = parseTableList(ledger);
    if (!list.ok || list.tables.length !== 1) fail(`schema-guard: --app-ledger must be one table or schema.table, got "${ledger}".`, USAGE_EXIT_CODE);
    return ledger;
  }
  return flags["app-journal"] === undefined ? null : DEFAULT_APP_LEDGER;
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
 * `softure-deploy row-counts [--tables=… | --config=deploy.json] [--out=…] [--compare=…] [--stdin]`: counts the app's
 * key tables (one the database lacks is `absent`); with `--compare`, fails when a table has fewer rows than in the
 * earlier file, was not in it, or is absent now. A table absent before and counted now is new and passes.
 * `--print-query` prints the snapshot statement `--stdin` reads.
 */
export async function runRowCounts(args: string[], io: CliIo): Promise<void> {
  const flags = readFlags("row-counts", args, {
    tables: { type: "string" },
    config: { type: "string" },
    out: { type: "string" },
    compare: { type: "string" },
    "url-env": { type: "string" },
    stdin: { type: "boolean", default: false },
    "print-query": { type: "boolean", default: false },
  });
  const tables = readRowCountTables(flags, io.cwd);
  if (flags["print-query"]) {
    if (flags.stdin || flags.out !== undefined || flags.compare !== undefined || flags["url-env"] !== undefined) {
      fail("row-counts: --print-query takes only --tables or --config.", USAGE_EXIT_CODE);
    }
    io.stdout(`${buildRowCountQuery(tables)}\n`);
    return;
  }
  const before = flags.compare === undefined ? null : readRowCountsFile(resolve(io.cwd, flags.compare), flags.compare);
  let counts: RowCounts;
  if (flags.stdin) {
    if (flags["url-env"] !== undefined) fail("row-counts: --stdin reads the counts from stdin; drop --url-env.", USAGE_EXIT_CODE);
    counts = await readSnapshotInput("row-counts", io, (text) => parseRowCountSnapshot(text, tables));
  } else {
    const url = readDatabaseUrl("row-counts", io.env, flags["url-env"] ?? DEFAULT_URL_ENV);
    const read = await runOnDatabase("row-counts", url, async (client) => {
      const result = await client.query<{ snapshot: string }>(buildRowCountQuery(tables));
      return parseRowCountSnapshot(result.rows[0]?.snapshot ?? "", tables);
    });
    if (!read.ok) fail(`row-counts: ${read.problem}.`);
    counts = read.value;
  }
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
