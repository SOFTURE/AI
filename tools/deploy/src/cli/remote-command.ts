// `run` and `report`: an ops script of the live image, or a read-only SQL file, on the server through the forced SSH
// command of `init`'s deploy.sh (issue #247); `cleanup` frees the server's disk the same way (issue #1171). Nothing is shipped but the SQL of a report: a script runs from the
// image the release built. ssh runs with an argument list, never a shell; the server splits the command line on
// blanks and evaluates none of it, so a value with a blank cannot pass and is refused here. `run --local` runs the
// same script on this machine instead (local-command.ts).
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { runChild } from "./child-process.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { isLocalRun, OPS_SCRIPT_NAME as SCRIPT_NAME, runLocalScript } from "./local-command.js";
import { MAX_RELEASE_KEEP, MIN_RELEASE_KEEP } from "../verify/schema.js";

const ARGUMENT = /^--[a-z][a-z0-9-]*(?:=\S*)?$/;
const HOST = /^[A-Za-z0-9_][A-Za-z0-9_.@:-]*$/;
const PORT = /^[1-9][0-9]{0,4}$/;
/** `--<key>-file=<path>`: a secret the script reads from a file, `-` for stdin. */
const FILE_ARGUMENT = /^--([a-z][a-z0-9-]*-file)=(.+)$/s;
const STDIN_PATH = "-";
/** ssh's own failure (connection, authentication), as opposed to the remote command's status. */
const SSH_FAILED = 255;

interface Connection {
  readonly host: string;
  readonly port: string | null;
  readonly ssh: string;
}

interface CommandLine {
  readonly connection: Connection;
  /** The script name or the SQL file: the first word after the client flags. */
  readonly target: string;
  /** Everything after it, for the script or the report. */
  readonly rest: readonly string[];
}

const CLIENT_FLAG = /^--(host|port|ssh)=(.*)$/s;

type ClientFlags = Partial<Record<"host" | "port" | "ssh", string>>;

/** Sets one client flag of a `--host=`, `--port=` or `--ssh=` argument; false when the argument is none of them. */
function readClientFlag(command: string, arg: string, flags: ClientFlags): boolean {
  const match = CLIENT_FLAG.exec(arg);
  const name = match?.[1] as "host" | "port" | "ssh" | undefined;
  if (name === undefined) return false;
  if (flags[name] !== undefined) fail(`${command}: --${name} is given twice`, USAGE_EXIT_CODE);
  flags[name] = match?.[2] ?? "";
  return true;
}

/** The connection of the client flags, each checked. */
function toConnection(command: string, flags: ClientFlags): Connection {
  if (flags.host === undefined) fail(`${command}: --host=<ssh host> is required`, USAGE_EXIT_CODE);
  if (!HOST.test(flags.host)) fail(`${command}: --host is not an ssh host or alias: "${flags.host}"`, USAGE_EXIT_CODE);
  if (flags.port !== undefined && !PORT.test(flags.port)) fail(`${command}: --port is not a port: "${flags.port}"`, USAGE_EXIT_CODE);
  if (flags.ssh === "") fail(`${command}: --ssh needs a program`, USAGE_EXIT_CODE);
  return { host: flags.host, port: flags.port ?? null, ssh: flags.ssh ?? "ssh" };
}

/** Client flags come first; the first other word is the script or file, and the rest belongs to it. */
function parseCommandLine(command: string, args: readonly string[]): CommandLine {
  const flags: ClientFlags = {};
  let index = 0;
  for (; index < args.length; index++) {
    const arg = args[index] ?? "";
    if (!arg.startsWith("-")) break;
    if (!readClientFlag(command, arg, flags)) {
      fail(`${command}: unknown option "${arg}" before the ${command === "run" ? "script" : "file"}`, USAGE_EXIT_CODE);
    }
  }
  const target = args[index];
  const connection = toConnection(command, flags);
  if (target === undefined) {
    fail(`${command}: ${command === "run" ? "the ops script name" : "the SQL file"} is missing`, USAGE_EXIT_CODE);
  }
  return { connection, target, rest: args.slice(index + 1) };
}

function checkArguments(command: string, args: readonly string[]): void {
  for (const arg of args) {
    if (/\s/.test(arg) && /^--[a-z][a-z0-9-]*=/.test(arg)) {
      const key = arg.slice(2, arg.indexOf("="));
      fail(`${command}: the value of --${key} holds a blank, which the server cannot pass on; put it in a file and use --${key}-file`, USAGE_EXIT_CODE);
    }
    if (!ARGUMENT.test(arg)) fail(`${command}: arguments look like --key or --key=value: "${arg}"`, USAGE_EXIT_CODE);
  }
}

/** Runs ssh with the remote command, streams its output and returns its exit status. */
async function runSsh(connection: Connection, remote: readonly string[], input: Readable | null, io: CliIo): Promise<number> {
  const args = ["-T", ...(connection.port === null ? [] : ["-p", connection.port]), "--", connection.host, remote.join(" ")];
  const status = await runChild({ program: connection.ssh, args, env: io.env, input }, io);
  if (status === SSH_FAILED) {
    io.stderr(`softure-deploy: ssh to ${connection.host} failed (exit ${String(SSH_FAILED)}); nothing ran on the server.\n`);
    return 1;
  }
  return status;
}

async function readLocalFile(command: string, path: string, io: CliIo): Promise<Buffer> {
  try {
    return await readFile(resolve(io.cwd, path));
  } catch {
    return fail(`${command}: cannot read ${path}`);
  }
}

/**
 * `run --host=<ssh host> [--port=<n>] [--ssh=ssh] <script> [args]`: the script's dry run, or its change with
 * `--commit`, in the live app container. One `--<key>-file=<path>` is read here and sent on stdin as
 * `--<key>-file=-`; otherwise stdin is forwarded, so `--<key>-file=-` reads the operator's own.
 */
export async function runRemoteScript(args: string[], io: CliIo): Promise<number> {
  if (isLocalRun(args)) return runLocalScript(args, io);
  const line = parseCommandLine("run", args);
  if (!SCRIPT_NAME.test(line.target)) fail(`run: the ops script name is not kebab-case: "${line.target}"`, USAGE_EXIT_CODE);
  checkArguments("run", line.rest);
  const fileArguments = line.rest.filter((arg) => FILE_ARGUMENT.test(arg));
  if (fileArguments.length > 1) {
    fail(`run: only one --<key>-file can travel on stdin; got ${fileArguments.join(", ")}`, USAGE_EXIT_CODE);
  }
  let input: Readable | null = io.stdin ?? null;
  const remote = ["run", line.target];
  for (const arg of line.rest) {
    const file = FILE_ARGUMENT.exec(arg);
    if (file === null || file[2] === STDIN_PATH) {
      remote.push(arg);
      continue;
    }
    input = Readable.from([await readLocalFile("run", file[2] ?? "", io)]);
    remote.push(`--${file[1] ?? ""}=${STDIN_PATH}`);
  }
  return runSsh(line.connection, remote, input, io);
}

/**
 * `report --host=<ssh host> [--port=<n>] [--ssh=ssh] <file.sql> [--key=value …]`: the file through psql on the server,
 * read only, each `--key=value` a psql variable.
 */
export async function runRemoteReport(args: string[], io: CliIo): Promise<number> {
  const line = parseCommandLine("report", args);
  checkArguments("report", line.rest);
  for (const arg of line.rest) {
    if (arg === "--commit") fail("report: a report is read only; --commit has no meaning here", USAGE_EXIT_CODE);
    if (!arg.includes("=")) fail(`report: arguments look like --key=value: "${arg}"`, USAGE_EXIT_CODE);
  }
  const sql = await readLocalFile("report", line.target, io);
  if (sql.length === 0) fail(`report: ${line.target} is empty`);
  return runSsh(line.connection, ["report", ...line.rest], Readable.from([sql]), io);
}

const KEEP_FLAG = /^--keep=(.*)$/s;

/**
 * `cleanup --host=<ssh host> [--port=<n>] [--ssh=ssh] [--keep=<n>] [--commit]`: the server's cleanup of this app's old
 * releases and images, the old tools images, dangling images and build cache; a dry run that names what would go and
 * the bytes it frees unless `--commit`. `--keep` (2 to 50) overrides `releases.keep` of the installed deploy.json.
 */
export async function runRemoteCleanup(args: string[], io: CliIo): Promise<number> {
  const flags: ClientFlags = {};
  let keep: string | undefined;
  let isCommit = false;
  for (const arg of args) {
    if (readClientFlag("cleanup", arg, flags)) continue;
    if (arg === "--commit") {
      if (isCommit) fail("cleanup: --commit is given twice", USAGE_EXIT_CODE);
      isCommit = true;
      continue;
    }
    const keepValue = KEEP_FLAG.exec(arg)?.[1];
    if (keepValue === undefined) fail(`cleanup: unknown argument "${arg}"; it takes --keep=<n> and --commit`, USAGE_EXIT_CODE);
    if (keep !== undefined) fail("cleanup: --keep is given twice", USAGE_EXIT_CODE);
    const count = /^[0-9]{1,3}$/.test(keepValue) ? Number(keepValue) : Number.NaN;
    if (!(count >= MIN_RELEASE_KEEP && count <= MAX_RELEASE_KEEP)) {
      fail(`cleanup: --keep is a number from ${String(MIN_RELEASE_KEEP)} to ${String(MAX_RELEASE_KEEP)}: "${keepValue}"`, USAGE_EXIT_CODE);
    }
    keep = String(count);
  }
  const connection = toConnection("cleanup", flags);
  const remote = ["cleanup", ...(keep === undefined ? [] : [`--keep=${keep}`]), ...(isCommit ? ["--commit"] : [])];
  // Nothing travels on stdin: the server reads none, and ssh gets an empty one rather than the terminal.
  return runSsh(connection, remote, Readable.from([]), io);
}
