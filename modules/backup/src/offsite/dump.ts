// The night's dump for a host without a server (a Cloudflare app's scheduled workflow): `pg_dump --format=custom` of
// the database at a URL, to stdout, into a hidden file that becomes the backup file only once pg_dump exited 0, so a
// dump cut short is never uploaded. The URL goes in as libpq variables, never as an argument. Writing to stdout lets
// `BACKUP_PG_DUMP` be a `docker run postgres:<major> pg_dump` wrapper of the server's major version.
import { spawn } from "node:child_process";
import { createWriteStream, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { toLibpqEnv } from "@softure-ai/deploy";

const MAX_STDERR = 4000;
const PASSED_ENV = ["PATH", "HOME", "LANG", "DOCKER_HOST", "DOCKER_CONFIG"] as const;

export interface PgDumpOptions {
  readonly url: string;
  /** The backup file to write, e.g. `<dir>/db-20261117T031700Z.dump`. */
  readonly out: string;
  /** Tables whose rows the dump leaves out (deploy.json `database.excludeTableData`). */
  readonly excludeTableData: readonly string[];
  /** The executable: a name on PATH or a path. */
  readonly pgDump: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

export type PgDumpResult = { ok: true; bytes: number } | { ok: false; problem: string };

/** `db-<YYYYMMDD>T<HHMMSS>Z.dump`, the deploy's own backup name, so the off-site keys sort with a VPS's. */
export function buildDumpFileName(at: Date): string {
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `db-${stamp}.dump`;
}

/** The arguments of the dump: custom format, no password prompt, the excluded tables' rows left out. */
export function buildPgDumpArgs(excludeTableData: readonly string[]): string[] {
  return ["--format=custom", "--no-password", ...excludeTableData.map((table) => `--exclude-table-data=${table}`)];
}

export async function runPgDump(options: PgDumpOptions): Promise<PgDumpResult> {
  const libpq = toLibpqEnv(options.url);
  if (!libpq.ok) return { ok: false, problem: libpq.problem };
  const env: Record<string, string> = { ...libpq.env };
  for (const name of PASSED_ENV) {
    const value = options.env[name];
    if (value !== undefined) env[name] = value;
  }
  const partial = join(dirname(options.out), `.partial-${basename(options.out)}`);
  const file = createWriteStream(partial, { mode: 0o600 });
  const fileOpened = new Promise<void>((resolve, reject) => {
    file.once("open", () => {
      resolve();
    });
    file.once("error", reject);
  });
  try {
    await fileOpened;
  } catch (error) {
    return { ok: false, problem: `cannot write ${partial} (${error instanceof Error ? error.message : String(error)})` };
  }
  const child = spawn(options.pgDump, buildPgDumpArgs(options.excludeTableData), { env, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  let bytes = 0;
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString("utf8")).slice(-MAX_STDERR);
  });
  child.stdout.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
  });
  child.stdout.pipe(file);
  const written = new Promise<void>((resolve, reject) => {
    file.once("finish", resolve);
    file.once("error", reject);
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      resolve(code);
    });
  });
  let code: number | null;
  try {
    code = await exited;
    await written;
  } catch (error) {
    file.destroy();
    rmSync(partial, { force: true });
    return { ok: false, problem: `cannot run ${options.pgDump} (${error instanceof Error ? error.message : String(error)})` };
  }
  if (code !== 0) {
    rmSync(partial, { force: true });
    return { ok: false, problem: `pg_dump exited with ${String(code)}: ${stderr.trim().split("\n").slice(-3).join(" / ")}` };
  }
  if (bytes === 0) {
    rmSync(partial, { force: true });
    return { ok: false, problem: "pg_dump wrote nothing" };
  }
  renameSync(partial, options.out);
  return { ok: true, bytes };
}
