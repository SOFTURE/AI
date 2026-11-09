// The Postgres side of restore and verify: an admin connection from a URL in the environment, databases created and
// dropped through it, and pg_restore fed from a decrypted stream with the URL as libpq variables, so the password
// never shows in the process list.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { toLibpqEnv, withPgClient } from "@softure-ai/deploy";
import { pipeStreamTo } from "./crypto.js";

/** Database names this package creates or accepts: lower-case identifiers within Postgres's 63 bytes. */
const DATABASE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;
const MAX_STDERR = 4000;

export function isDatabaseName(name: string): boolean {
  return DATABASE_NAME.test(name);
}

/** The URL with another database. */
export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/** The database of a URL (`postgres` when it names none). */
export function getUrlDatabase(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  return name === "" ? "postgres" : name;
}

/** `softure_offsite_verify_<8 hex>`: a fresh throwaway name. */
export function createVerifyDatabaseName(): string {
  return `softure_offsite_verify_${randomBytes(4).toString("hex")}`;
}

/** `<base>_restore_<YYYYMMDDHHMMSS>`, shortened so it stays a valid name. */
export function createRestoreDatabaseName(base: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const safeBase = base.replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z_]/, "_").slice(0, 63 - "_restore_".length - stamp.length);
  return `${safeBase}_restore_${stamp}`;
}

export async function databaseExists(adminUrl: string, name: string): Promise<boolean> {
  return withPgClient(adminUrl, async (client) => {
    const result = await client.query<{ present: boolean }>("SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS present", [name]);
    return result.rows[0]?.present === true;
  });
}

export async function createDatabase(adminUrl: string, name: string): Promise<void> {
  if (!isDatabaseName(name)) throw new Error(`${name} is not a database name this tool creates`);
  await withPgClient(adminUrl, async (client) => {
    await client.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
  });
}

/** Drops `name`, ending its connections first (Postgres 13+). */
export async function dropDatabase(adminUrl: string, name: string): Promise<void> {
  if (!isDatabaseName(name)) throw new Error(`${name} is not a database name this tool drops`);
  await withPgClient(adminUrl, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  });
}

export interface PgRestoreOptions {
  readonly adminUrl: string;
  readonly database: string;
  /** Extra flags: `--no-owner`, `--no-acl`, `--clean --if-exists`. */
  readonly flags: readonly string[];
  readonly dump: ReadableStream<Uint8Array>;
  /** The executable: a name on PATH or a path. */
  readonly pgRestore: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

export type PgRestoreResult = { ok: true } | { ok: false; problem: string };

/** `pg_restore --exit-on-error` of the dump on stdin into `database`. */
export async function runPgRestore(options: PgRestoreOptions): Promise<PgRestoreResult> {
  const libpq = toLibpqEnv(options.adminUrl);
  if (!libpq.ok) return { ok: false, problem: libpq.problem };
  const env: Record<string, string> = { ...libpq.env, PGDATABASE: options.database };
  for (const name of ["PATH", "HOME", "LANG"]) {
    const value = options.env[name];
    if (value !== undefined) env[name] = value;
  }
  const child = spawn(options.pgRestore, ["--exit-on-error", "--no-password", ...options.flags, "--dbname", options.database], {
    env,
    stdio: ["pipe", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString("utf8")).slice(-MAX_STDERR);
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code);
    });
  });
  // A pg_restore that stops early closes its stdin; the pipe error is then the exit status's to report.
  const fed = pipeStreamTo(options.dump, child.stdin).then(
    () => null,
    (error: unknown) => error,
  );
  let code: number | null;
  try {
    code = await exited;
  } catch (error) {
    return { ok: false, problem: `cannot run ${options.pgRestore} (${error instanceof Error ? error.message : String(error)})` };
  }
  const feedError = await fed;
  if (code !== 0) return { ok: false, problem: `pg_restore exited with ${String(code)}: ${stderr.trim().split("\n").slice(-3).join(" / ")}` };
  if (feedError !== null) return { ok: false, problem: `the backup stream failed (${feedError instanceof Error ? feedError.message : "unknown error"})` };
  return { ok: true };
}
