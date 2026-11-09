// `softure-backup <command>`: the host's nightly upload, and restore, fetch, verify and lifecycle for the operator.
// Secrets come only from the environment and the private key only from a file or stdin; an argument that looks like
// a key is refused, so nothing secret ever shows in `ps` or a shell history. Exit status: 0 done, 1 failed, 2 usage.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseDeployConfig, parseTableList } from "@softure-ai/deploy";
import { createLogger } from "@softure-ai/observability";
import {
  collectSecrets,
  readReadConfig,
  readUploadConfig,
  redactSecrets,
  type ConfigResult,
  type StoreConfig,
} from "../offsite/config.js";
import { parseIdentities } from "../offsite/crypto.js";
import { buildLifecycleJson, buildLifecycleXml, parseLifecycleDays } from "../offsite/lifecycle.js";
import { fetchBackup, restoreBackup } from "../offsite/restore.js";
import { buildStatusSql } from "../offsite/status-sql.js";
import { buildNotConfiguredRecord, uploadBackups, type RunRecord } from "../offsite/upload.js";
import { DEFAULT_MAX_AGE_HOURS, selectVerifyTables, verifyBackup } from "../offsite/verify.js";

export interface CliIo {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  /** The text of stdin, read only for `--identity=-`. */
  readonly readStdin: () => Promise<string>;
  readonly now?: () => Date;
  readonly fetch?: typeof fetch;
}

const USAGE = `usage: softure-backup <command> [options]

  upload --app=<name> --file=<path>... [--status-sql=<file>] [--summary=<file>]
      encrypt and upload the night's backup files (BACKUP_S3_*, BACKUP_AGE_RECIPIENT)
  restore --identity=<file|-> [--key=<object>] [--into=<database>] [--overwrite] [--no-owner] [--app=<name>]
      restore a database backup (newest by default) into a new database (BACKUP_RESTORE_DATABASE_URL)
  fetch --identity=<file|-> --out=<file> [--kind=data|database] [--key=<object>] [--app=<name>]
      download and decrypt one object, e.g. the newest data archive
  verify --identity=<file|-> [--config=deploy.json] [--tables=a,b] [--migrations-dir=<dir>] [--max-age-hours=26]
      restore the newest copy into a throwaway database, check it, drop it (BACKUP_VERIFY_DATABASE_URL)
  lifecycle [--days=30] [--format=xml|json] [--app=<name>]
      print the bucket lifecycle rule that expires the prefix's objects
`;

const USAGE_EXIT = 2;
const SECRET_KEY_TEXT = /AGE-SECRET-KEY-/i;

class UsageError extends Error {}

function readConfigOrFail<T>(result: ConfigResult<T>, command: string): T {
  if (result.status === "ok") return result.config;
  if (result.status === "not_configured") throw new UsageError(`${command}: the off-site store is not configured (BACKUP_S3_*).`);
  throw new UsageError(`${command}: the off-site settings are not valid: ${result.problems.join("; ")}.`);
}

async function readIdentities(value: string | undefined, io: CliIo, command: string): Promise<string[]> {
  if (value === undefined) throw new UsageError(`${command}: --identity=<file> or --identity=- (stdin) is required.`);
  const text = value === "-" ? await io.readStdin() : readTextFile(resolve(io.cwd, value), command);
  const parsed = parseIdentities(text);
  if (!parsed.ok) throw new UsageError(`${command}: ${parsed.problem}.`);
  return parsed.identities;
}

function readTextFile(path: string, command: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    throw new UsageError(`${command}: cannot read ${path} (${(error as NodeJS.ErrnoException).code ?? "unknown error"}).`);
  }
}

function requireUrl(io: CliIo, name: string, command: string): string {
  const url = io.env[name]?.trim();
  if (url === undefined || url === "") throw new UsageError(`${command}: ${name} is not set (a superuser's postgres:// URL).`);
  if (!/^postgres(ql)?:\/\//.test(url)) throw new UsageError(`${command}: ${name} is not a postgres:// URL.`);
  return url;
}

function getAppName(app: string | undefined, io: CliIo, command: string): string {
  if (app !== undefined) return app;
  const prefix = io.env.BACKUP_S3_PREFIX?.trim();
  if (prefix !== undefined && prefix !== "") return prefix;
  throw new UsageError(`${command}: --app=<name> is required when BACKUP_S3_PREFIX is not set.`);
}

function describeRecord(record: RunRecord): string {
  if (record.result === "ok") {
    const seconds = ((record.finishedAt.getTime() - record.startedAt.getTime()) / 1000).toFixed(1);
    return `ok|${String(record.objects.length)} object(s), ${String(record.sizeBytes)} bytes in ${seconds} s`;
  }
  if (record.result === "not_configured") return "not_configured";
  return `failed|${record.error?.code ?? "upload_failed"}|${(record.error?.message ?? "").replace(/[\r\n|]+/g, " ")}`;
}

async function runUpload(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      app: { type: "string" },
      file: { type: "string", multiple: true, default: [] },
      "status-sql": { type: "string" },
      summary: { type: "string" },
    },
  });
  if (values.app === undefined) throw new UsageError("upload: --app=<name> is required (the default key prefix).");
  const now = io.now ?? (() => new Date());
  const logger = createLogger("@softure-ai/backup");
  const secrets = collectSecrets(io.env);
  const config = readUploadConfig(io.env, values.app);
  let record: RunRecord;
  if (config.status === "not_configured") {
    record = buildNotConfiguredRecord(now());
  } else if (config.status === "invalid") {
    const at = now();
    record = { startedAt: at, finishedAt: at, result: "failed", objects: [], sizeBytes: 0, error: { code: "config_invalid", message: config.problems.join("; ") } };
  } else {
    record = await uploadBackups({
      config: config.config,
      files: values.file.map((file) => resolve(io.cwd, file)),
      now,
      s3: { now, ...(io.fetch === undefined ? {} : { fetch: io.fetch }) },
      onUploaded: (object) => {
        logger.info("off-site backup object uploaded", { key: object.key, bytes: object.bytes, sha256: object.sha256 });
      },
    });
  }
  if (record.error !== null) record = { ...record, error: { ...record.error, message: redactSecrets(record.error.message, secrets) } };
  if (values["status-sql"] !== undefined) writeFileSync(resolve(io.cwd, values["status-sql"]), buildStatusSql(record), { mode: 0o600 });
  const summary = describeRecord(record);
  if (values.summary !== undefined) writeFileSync(resolve(io.cwd, values.summary), `${summary}\n`, { mode: 0o600 });
  const durationMs = record.finishedAt.getTime() - record.startedAt.getTime();
  if (record.result === "failed") {
    logger.error("off-site backup failed", { result: record.result, code: record.error?.code, message: record.error?.message, durationMs });
    io.stderr(`upload: failed (${record.error?.code ?? ""}): ${record.error?.message ?? ""}\n`);
    return 1;
  }
  if (record.result === "not_configured") {
    io.stdout("upload: not configured (no BACKUP_S3_* in the environment); nothing uploaded.\n");
    return 0;
  }
  logger.info("off-site backup succeeded", { result: record.result, objects: record.objects.length, bytes: record.sizeBytes, durationMs });
  for (const object of record.objects) io.stdout(`upload: ${object.key} (${String(object.bytes)} bytes, sha256 ${object.sha256})\n`);
  return 0;
}

async function runRestore(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      identity: { type: "string" },
      key: { type: "string" },
      into: { type: "string" },
      overwrite: { type: "boolean", default: false },
      "no-owner": { type: "boolean", default: false },
      app: { type: "string" },
      "pg-restore": { type: "string" },
    },
  });
  const store: StoreConfig = readConfigOrFail(readReadConfig(io.env, getAppName(values.app, io, "restore")), "restore");
  const adminUrl = requireUrl(io, "BACKUP_RESTORE_DATABASE_URL", "restore");
  if (values.overwrite && values.into === undefined) throw new UsageError("restore: --overwrite needs --into=<database>, the database to restore over.");
  const identities = await readIdentities(values.identity, io, "restore");
  const result = await restoreBackup({
    store,
    identities,
    adminUrl,
    ...(values.key === undefined ? {} : { key: values.key }),
    ...(values.into === undefined ? {} : { into: values.into }),
    overwrite: values.overwrite,
    noOwner: values["no-owner"],
    pgRestore: values["pg-restore"] ?? io.env.BACKUP_PG_RESTORE ?? "pg_restore",
    env: io.env,
    ...(io.now === undefined ? {} : { now: io.now() }),
    s3: io.fetch === undefined ? {} : { fetch: io.fetch },
  });
  if (!result.ok) {
    io.stderr(`restore: ${redactSecrets(result.problem, collectSecrets(io.env))}\n`);
    return 1;
  }
  io.stdout(`restore: ${result.value.key} restored into ${result.value.created ? "the new database" : "the existing database"} ${result.value.database}\n`);
  return 0;
}

async function runFetch(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      identity: { type: "string" },
      key: { type: "string" },
      kind: { type: "string", default: "data" },
      out: { type: "string" },
      app: { type: "string" },
    },
  });
  if (values.kind !== "data" && values.kind !== "database") throw new UsageError("fetch: --kind is data or database.");
  if (values.out === undefined) throw new UsageError("fetch: --out=<file> is required.");
  const store = readConfigOrFail(readReadConfig(io.env, getAppName(values.app, io, "fetch")), "fetch");
  const identities = await readIdentities(values.identity, io, "fetch");
  const result = await fetchBackup({
    store,
    identities,
    kind: values.kind,
    out: resolve(io.cwd, values.out),
    ...(values.key === undefined ? {} : { key: values.key }),
    s3: io.fetch === undefined ? {} : { fetch: io.fetch },
  });
  if (!result.ok) {
    io.stderr(`fetch: ${redactSecrets(result.problem, collectSecrets(io.env))}\n`);
    return 1;
  }
  io.stdout(`fetch: ${result.value.key} decrypted to ${result.value.out}\n`);
  return 0;
}

function readVerifyTables(config: string | undefined, tables: string | undefined, io: CliIo): string[] {
  if (tables !== undefined) {
    const parsed = parseTableList(tables);
    if (!parsed.ok) throw new UsageError(`verify: --tables: ${parsed.problem}.`);
    return parsed.tables;
  }
  if (config === undefined) return [];
  const path = resolve(io.cwd, config);
  let json: unknown;
  try {
    json = JSON.parse(readTextFile(path, "verify"));
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError(`verify: ${path} is not JSON.`);
  }
  const parsed = parseDeployConfig(json);
  if (!parsed.ok) throw new UsageError(`verify: ${path} is not a valid deploy.json: ${parsed.issues.join("; ")}.`);
  return selectVerifyTables(parsed.config.database?.rowCountTables, parsed.config.database?.excludeTableData);
}

async function runVerify(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      identity: { type: "string" },
      config: { type: "string" },
      tables: { type: "string" },
      "migrations-dir": { type: "string" },
      "max-age-hours": { type: "string" },
      app: { type: "string" },
      "pg-restore": { type: "string" },
    },
  });
  const maxAgeText = values["max-age-hours"];
  const maxAgeHours = maxAgeText === undefined ? DEFAULT_MAX_AGE_HOURS : Number(maxAgeText);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 24 * 366) throw new UsageError("verify: --max-age-hours is a number of hours above 0.");
  const store = readConfigOrFail(readReadConfig(io.env, getAppName(values.app, io, "verify")), "verify");
  const adminUrl = requireUrl(io, "BACKUP_VERIFY_DATABASE_URL", "verify");
  const tables = readVerifyTables(values.config, values.tables, io);
  const identities = await readIdentities(values.identity, io, "verify");
  const logger = createLogger("@softure-ai/backup");
  const result = await verifyBackup({
    store,
    identities,
    adminUrl,
    tables,
    ...(values["migrations-dir"] === undefined ? {} : { migrationsDir: resolve(io.cwd, values["migrations-dir"]) }),
    maxAgeHours,
    pgRestore: values["pg-restore"] ?? io.env.BACKUP_PG_RESTORE ?? "pg_restore",
    env: io.env,
    ...(io.now === undefined ? {} : { now: io.now() }),
    s3: io.fetch === undefined ? {} : { fetch: io.fetch },
  });
  if (!result.ok) {
    const problem = redactSecrets(result.problem, collectSecrets(io.env));
    logger.error("off-site backup verify failed", { problem });
    io.stderr(`verify: ${problem}\n`);
    return 1;
  }
  const counts = Object.entries(result.value.counts).map(([table, count]) => `${table}=${String(count)}`).join(",");
  logger.info("off-site backup verified", { key: result.value.key, ageHours: Number(result.value.ageHours.toFixed(1)), schemaGuard: result.value.schemaGuard });
  io.stdout(
    `verify: ${result.value.key} (${result.value.ageHours.toFixed(1)} h old) restores; schema guard ${result.value.schemaGuard}; ${counts === "" ? "no tables listed" : counts}\n`,
  );
  return 0;
}

function runLifecycle(args: string[], io: CliIo): number {
  const { values } = parseArgs({
    args,
    strict: true,
    options: { days: { type: "string" }, format: { type: "string", default: "xml" }, app: { type: "string" } },
  });
  const days = parseLifecycleDays(values.days);
  if (!days.ok) throw new UsageError(`lifecycle: ${days.problem}.`);
  const prefix = getAppName(values.app, io, "lifecycle");
  if (values.format === "xml") io.stdout(buildLifecycleXml(prefix, days.days));
  else if (values.format === "json") io.stdout(buildLifecycleJson(prefix, days.days));
  else throw new UsageError("lifecycle: --format is xml or json.");
  return 0;
}

export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  const [command, ...args] = argv;
  try {
    if (args.some((arg) => SECRET_KEY_TEXT.test(arg))) {
      throw new UsageError("an argument holds an age secret key; pass it through --identity=<file> or --identity=- (stdin), never as an argument.");
    }
    switch (command) {
      case "upload":
        return await runUpload(args, io);
      case "restore":
        return await runRestore(args, io);
      case "fetch":
        return await runFetch(args, io);
      case "verify":
        return await runVerify(args, io);
      case "lifecycle":
        return runLifecycle(args, io);
      case undefined:
      case "--help":
      case "help":
        io.stdout(USAGE);
        return command === undefined ? USAGE_EXIT : 0;
      default:
        throw new UsageError(`unknown command ${command}.\n${USAGE}`);
    }
  } catch (error) {
    if (error instanceof UsageError || (error instanceof TypeError && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS"))) {
      io.stderr(`softure-backup: ${error.message}\n`);
      return USAGE_EXIT;
    }
    io.stderr(`softure-backup: ${command ?? ""} failed: ${redactSecrets(error instanceof Error ? error.message : String(error), collectSecrets(io.env))}\n`);
    return 1;
  }
}
