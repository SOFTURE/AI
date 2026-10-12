// `run --local`: the ops script an image would bundle (`scripts/ops/<name>.ts`) run on this machine against
// `DATABASE_URL` (issue #405), so an app's wrapper is an npm alias, not a second argument parser. The script keeps
// its own dry run, `--commit`, `--help` and `--<key>-file`; this command only finds it, names the database it is
// about to touch and hands it the arguments as a list, so a value with a blank passes here.
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runChild } from "./child-process.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";

/** An ops script name, as the operator types it and the image names `ops/<name>.mjs`. */
export const OPS_SCRIPT_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ARGUMENT = /^--[a-z][a-z0-9-]*(?:=.*)?$/s;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LOCAL_FLAG = /^--(local|url-env|scripts-dir|tsx)(?:=(.*))?$/s;
const REMOTE_FLAG = /^--(host|port|ssh)(?:=|$)/;
const DATABASE_URL = "DATABASE_URL";
const DEFAULT_SCRIPTS_DIR = "scripts/ops";
const DEFAULT_RUNNER = "tsx";

type LocalFlag = "url-env" | "scripts-dir" | "tsx";

interface LocalCommandLine {
  readonly flags: Readonly<Partial<Record<LocalFlag, string>>>;
  readonly script: string;
  readonly rest: readonly string[];
}

/** The client flags: the words before the first one that does not start with `-`. */
function getClientFlags(args: readonly string[]): readonly string[] {
  const end = args.findIndex((arg) => !arg.startsWith("-"));
  return end === -1 ? args : args.slice(0, end);
}

/** Whether `run`'s client flags ask for a local run. */
export function isLocalRun(args: readonly string[]): boolean {
  return getClientFlags(args).includes("--local");
}

function parseLocalCommandLine(args: readonly string[]): LocalCommandLine {
  const clientFlags = getClientFlags(args);
  const flags: Partial<Record<LocalFlag | "local", string>> = {};
  for (const arg of clientFlags) {
    if (REMOTE_FLAG.test(arg)) {
      fail(`run: ${arg.split("=")[0] ?? arg} belongs to a run on the server; --local runs on this machine`, USAGE_EXIT_CODE);
    }
    const match = LOCAL_FLAG.exec(arg);
    const name = match?.[1] as LocalFlag | "local" | undefined;
    if (name === undefined) fail(`run: unknown option "${arg}" before the script`, USAGE_EXIT_CODE);
    if (flags[name] !== undefined) fail(`run: --${name} is given twice`, USAGE_EXIT_CODE);
    const value = match?.[2];
    if (name === "local" && value !== undefined) fail("run: --local takes no value", USAGE_EXIT_CODE);
    if (name !== "local" && (value === undefined || value === "")) fail(`run: --${name} needs a value`, USAGE_EXIT_CODE);
    flags[name] = value ?? "";
  }
  if (flags["url-env"] !== undefined && !ENV_NAME.test(flags["url-env"])) {
    fail(`run: --url-env is not a variable name: "${flags["url-env"]}"`, USAGE_EXIT_CODE);
  }
  const script = args[clientFlags.length];
  if (script === undefined) fail("run: the ops script name is missing", USAGE_EXIT_CODE);
  if (!OPS_SCRIPT_NAME.test(script)) fail(`run: the ops script name is not kebab-case: "${script}"`, USAGE_EXIT_CODE);
  const rest = args.slice(clientFlags.length + 1);
  for (const arg of rest) {
    if (!ARGUMENT.test(arg)) fail(`run: arguments look like --key or --key=value: "${arg}"`, USAGE_EXIT_CODE);
  }
  return { flags, script, rest };
}

/** `host[:port]/database` of a connection URL, never its user or password; `null` when it is not a URL. */
export function describeDatabaseUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "") return null;
    return `${parsed.hostname}${parsed.port === "" ? "" : `:${parsed.port}`}${parsed.pathname}`;
  } catch {
    return null;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** The script names a folder holds (`<name>.ts`, tests aside), sorted; none when it cannot be read. */
async function listScripts(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries
      .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts"))
      .map((entry) => entry.slice(0, -".ts".length))
      .sort();
  } catch {
    return [];
  }
}

/**
 * `run --local [--url-env=DATABASE_URL] [--scripts-dir=scripts/ops] [--tsx=tsx] <script> [args]`: runs
 * `<scripts-dir>/<script>.ts` with tsx in the working folder, the words after the name as its arguments and stdin
 * forwarded, with `DATABASE_URL` set from `--url-env` when given. Returns the script's exit status.
 */
export async function runLocalScript(args: readonly string[], io: CliIo): Promise<number> {
  const line = parseLocalCommandLine(args);
  const urlEnv = line.flags["url-env"] ?? DATABASE_URL;
  const url = io.env[urlEnv];
  if (url === undefined || url === "") fail(`run --local: ${urlEnv} is not set; nothing ran`);
  const scriptsDir = line.flags["scripts-dir"] ?? DEFAULT_SCRIPTS_DIR;
  const scriptPath = join(scriptsDir, `${line.script}.ts`);
  if (!(await isFile(resolve(io.cwd, scriptPath)))) {
    const available = await listScripts(resolve(io.cwd, scriptsDir));
    fail(`run --local: ${scriptsDir} has no ops script "${line.script}"; it has: ${available.join(" ") || "none"}`);
  }
  const target = describeDatabaseUrl(url) ?? `the database in ${urlEnv}`;
  io.stderr(`softure-deploy: ops script ${line.script} locally against ${target}\n`);
  const runner = line.flags.tsx ?? DEFAULT_RUNNER;
  return runChild(
    { program: runner, args: [scriptPath, ...line.rest], env: { ...io.env, [DATABASE_URL]: url }, input: io.stdin ?? null },
    io,
  );
}
