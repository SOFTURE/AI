// Safe ops scripts: one-off changes an operator runs against a live database (grant access, fix a
// record, move an account), one pattern for all of them:
//
// - **dry run by default**: the script runs inside one transaction that is rolled back, and prints
//   what it would change; only `--commit` writes;
// - **one transaction**: the whole change commits or nothing does, also when the script throws;
// - **measured, not assumed**: the script returns the state `before` and `after` its change, read
//   inside the open transaction, and the helper refuses a report without both;
// - **strict input**: `--key=value` arguments validated with the script's zod schema; anything
//   unknown is a usage error, never ignored;
// - **secrets off argv**: a key the script names in `secrets` also comes as `--<key>-file=<path>`
//   (`-` reads stdin), so a password never lands in shell history or in `docker exec`'s argv;
// - **a guard test**: `executeOpsScript` runs the same script on a test database (PGlite) with and
//   without `commit`, so the change and its refusals are tested before anyone runs it in production.
import { errorLogLabel, err, ok, safeError, type Err, type Ok, type SoftureConfig } from "@softure-ai/core";
import { openCommandDatabase, type Database, type Queryable } from "@softure-ai/db";
import { readFile } from "node:fs/promises";
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, type CliOutput } from "@softure-ai/db/cli";
import type { z } from "zod";

const SCRIPT_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ARGUMENT = /^--([a-z][a-z0-9-]*)(?:=(.*))?$/s;
const RESERVED_ARGUMENTS = new Set(["commit", "help"]);
const ARGUMENT_KEY = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const FILE_SUFFIX = "-file";
const STDIN_PATH = "-";

/** The state the script measured inside its transaction, before and after its change. */
export interface OpsReport {
  readonly before: unknown;
  readonly after: unknown;
}

/** A script's own refusal: an expected condition under which it must not change anything. */
export type OpsRefusal = Err<"ops.script_refused"> & { readonly reason: string };

export interface OpsScript<TArgs> {
  /** kebab-case, as the operator types it: `grant-access`. */
  readonly name: string;
  /** One line: what the script changes. */
  readonly description: string;
  /** The `--key=value` arguments, one line each, for `--help`. */
  readonly usage: readonly string[];
  /**
   * Parses the arguments: an object of the given keys, each a string (`--key=value`) or `true`
   * (`--flag`). Use `z.strictObject`, so a mistyped key is refused.
   */
  readonly args: z.ZodType<TArgs>;
  /**
   * Argument keys that carry a secret (a password, a token). Each also comes as `--<key>-file=<path>`,
   * read from that file, or `--<key>-file=-`, read from stdin; one trailing newline is dropped. The
   * script receives it under `<key>` as if given inline.
   */
  readonly secrets?: readonly string[];
  /**
   * The change, inside the transaction. Reads the state, changes it, reads it again. Returns
   * `refuseOpsScript(reason)` when it must not go on (no matching row, two matching rows);
   * the transaction is then rolled back.
   */
  readonly run: (tx: Queryable, args: TArgs) => Promise<Ok<OpsReport> | OpsRefusal>;
}

export type OpsScriptOutcome = Ok<{ readonly committed: boolean; readonly report: OpsReport }> | OpsRefusal;

export interface RunOpsScriptOptions<TArgs> {
  readonly script: OpsScript<TArgs>;
  /** The arguments after the script name: `process.argv.slice(2)`. */
  readonly argv: readonly string[];
  /** The app config; its `database.handle`, else its `database.url`, is opened unless `database` is given. */
  readonly config: Pick<SoftureConfig, "database">;
  /** An open database to use instead (tests); it is not closed. */
  readonly database?: Database;
  readonly output?: CliOutput;
  /** Where `--<key>-file` values come from; the file system and `process.stdin` by default. */
  readonly readInput?: OpsInputReader;
}

/** Reads the values of `--<key>-file` arguments. */
export interface OpsInputReader {
  readonly readFile: (path: string) => Promise<string>;
  readonly readStdin: () => Promise<string>;
}

/** A usage or setup problem, as a line for the operator. */
interface Problem {
  readonly ok: false;
  readonly message: string;
}

interface ParsedArguments {
  readonly commit: boolean;
  readonly help: boolean;
  readonly values: Readonly<Record<string, string | true>>;
}

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Thrown inside the transaction to roll a dry run back; never leaves `executeOpsScript`. */
class DryRunRollback extends Error {
  constructor(readonly report: OpsReport) {
    super("dry run: rolled back");
  }
}

/** Thrown inside the transaction to roll a refusal back; never leaves `executeOpsScript`. */
class RefusalRollback extends Error {
  constructor(readonly refusal: OpsRefusal) {
    super("refused: rolled back");
  }
}

/** Checks the script definition. Throws on an invalid name or an empty description: a bug in the script. */
export function defineOpsScript<TArgs>(script: OpsScript<TArgs>): OpsScript<TArgs> {
  if (!SCRIPT_NAME.test(script.name)) {
    throw new Error(`defineOpsScript: "${script.name}" is not a kebab-case script name`);
  }
  if (script.description.trim() === "") {
    throw new Error(`defineOpsScript: script "${script.name}" needs a description`);
  }
  for (const key of script.secrets ?? []) {
    if (!ARGUMENT_KEY.test(key) || RESERVED_ARGUMENTS.has(key)) {
      throw new Error(`defineOpsScript: script "${script.name}" names "${key}" as a secret; secrets are kebab-case argument keys`);
    }
  }
  return script;
}

/** The refusal a script returns from `run` to stop without changing anything. */
export function refuseOpsScript(reason: string): OpsRefusal {
  return { ...err("ops.script_refused"), reason };
}

/** Splits `--key=value`, `--flag`, `--commit` and `--help`; anything else is a usage error. */
export function parseOpsArguments(argv: readonly string[]): Ok<ParsedArguments> | Problem {
  const values: Record<string, string | true> = {};
  let commit = false;
  let help = false;
  for (const argument of argv) {
    const match = ARGUMENT.exec(argument);
    const key = match?.[1];
    if (key === undefined) {
      return problem(`unexpected argument "${argument}"; arguments look like --key=value`);
    }
    const value = match?.[2];
    if (RESERVED_ARGUMENTS.has(key)) {
      if (value !== undefined) return problem(`--${key} takes no value`);
      if (key === "commit") commit = true;
      else help = true;
      continue;
    }
    if (Object.hasOwn(values, key)) {
      return problem(`--${key} is given twice`);
    }
    values[key] = value ?? true;
  }
  return ok({ commit, help, values });
}

/**
 * Runs the script in one transaction on `db`: committed when `commit` is true, rolled back
 * otherwise and on a refusal. Errors thrown by the script or the database propagate after the
 * rollback. The guard test of a script calls this on a test database.
 */
export async function executeOpsScript<TArgs>(
  db: Database,
  script: OpsScript<TArgs>,
  args: TArgs,
  options: { readonly commit: boolean },
): Promise<OpsScriptOutcome> {
  try {
    const report = await db.transaction(async (tx) => {
      const result = await script.run(tx, args);
      if (!result.ok) {
        throw new RefusalRollback(result);
      }
      checkReport(script.name, result.value);
      if (!options.commit) {
        throw new DryRunRollback(result.value);
      }
      return result.value;
    });
    return ok({ committed: true, report });
  } catch (error) {
    if (error instanceof DryRunRollback) return ok({ committed: false, report: error.report });
    if (error instanceof RefusalRollback) return error.refusal;
    throw error;
  }
}

/**
 * The script as a command: parses `argv`, opens the database, runs the script and prints the
 * outcome. Returns the exit code: 0 done (dry run or committed), 1 refused or failed (nothing
 * written), 2 usage error.
 *
 *   // scripts/grant-access.ts
 *   import { runOpsScript } from "@softure-ai/ops/scripts";
 *   import config from "../softure.config";
 *   import { grantAccess } from "./grant-access-script";
 *   process.exitCode = await runOpsScript({ script: grantAccess, argv: process.argv.slice(2), config });
 */
export async function runOpsScript<TArgs>(options: RunOpsScriptOptions<TArgs>): Promise<number> {
  const { script } = options;
  const output = options.output ?? consoleOutput;
  const parsed = parseOpsArguments(options.argv);
  if (!parsed.ok) {
    output.error(`${script.name}: ${parsed.message}`);
    output.error(formatUsage(script));
    return EXIT_USAGE;
  }
  if (parsed.value.help) {
    output.log(formatUsage(script));
    return EXIT_OK;
  }
  const values = await readSecretArguments(script.secrets ?? [], parsed.value.values, options.readInput ?? processInput);
  if (!values.ok) {
    output.error(`${script.name}: ${values.message}`);
    output.error(formatUsage(script));
    return EXIT_USAGE;
  }
  const args = script.args.safeParse(values.value);
  if (!args.success) {
    args.error.issues.forEach((issue) => output.error(`${script.name}: ${formatIssue(issue)}`));
    output.error(formatUsage(script));
    return EXIT_USAGE;
  }

  const opened = await openDatabase(options);
  if (!opened.ok) {
    output.error(`${script.name}: ${opened.message}`);
    return EXIT_FAILED;
  }
  const { commit } = parsed.value;
  output.log(`${script.name}: ${commit ? "--commit: changes will be written" : "dry run: nothing will be written"}`);
  try {
    const outcome = await executeOpsScript(opened.value.db, script, args.data, { commit });
    if (!outcome.ok) {
      output.error(`${script.name}: refused: ${outcome.reason}`);
      output.error("nothing was written");
      return EXIT_FAILED;
    }
    output.log(`before: ${formatState(outcome.value.report.before)}`);
    output.log(`after:  ${formatState(outcome.value.report.after)}`);
    output.log(outcome.value.committed ? "COMMITTED" : "DRY RUN: rolled back, nothing was written. Add --commit to write.");
    return EXIT_OK;
  } catch (error) {
    output.error(`${script.name}: failed: ${describeFailure(error)}`);
    output.error("nothing was written");
    return EXIT_FAILED;
  } finally {
    await opened.value.close();
  }
}

/** What `runOpsMain` takes besides the script and the config module; tests pass a database and an output. */
export type RunOpsMainOptions = Partial<Omit<RunOpsScriptOptions<unknown>, "script" | "config">>;

/**
 * The whole entry of an ops script: finds the config in `configModule`, runs the script with
 * `process.argv.slice(2)` and sets `process.exitCode` (the process is never ended early, so output is
 * flushed and the pool closed). Works without top-level `await` and with the shapes a config import
 * takes when tsx loads `softure.config.ts` as CommonJS (an app without `"type": "module"`): the config
 * itself, `{ default }`, `{ default: { default } }` or `{ config }`. Resolves to the exit code too.
 *
 *   // scripts/grant-access.ts
 *   import { runOpsMain } from "@softure-ai/ops/scripts";
 *   import * as configModule from "../softure.config";
 *   import { grantAccess } from "./grant-access-script";
 *   void runOpsMain(grantAccess, configModule);
 */
export async function runOpsMain<TArgs>(
  script: OpsScript<TArgs>,
  configModule: unknown,
  options: RunOpsMainOptions = {},
): Promise<number> {
  const output = options.output ?? consoleOutput;
  const exitCode = await runMain(script, configModule, options, output);
  process.exitCode = exitCode;
  return exitCode;
}

async function runMain<TArgs>(
  script: OpsScript<TArgs>,
  configModule: unknown,
  options: RunOpsMainOptions,
  output: CliOutput,
): Promise<number> {
  const config = findConfig(configModule);
  if (config === undefined) {
    output.error(`${script.name}: the config module exports no Softure config (default or \`config\`); pass the module of softure.config`);
    return EXIT_FAILED;
  }
  try {
    return await runOpsScript({ ...options, script, config, argv: options.argv ?? process.argv.slice(2), output });
  } catch (error) {
    output.error(`${script.name}: failed: ${describeFailure(error)}`);
    return EXIT_FAILED;
  }
}

const MAX_CONFIG_UNWRAP = 3;

/** The config in a module namespace: itself or under `default` (once or twice) or `config`. */
function findConfig(configModule: unknown): Pick<SoftureConfig, "database"> | undefined {
  let candidate = configModule;
  for (let depth = 0; depth < MAX_CONFIG_UNWRAP; depth += 1) {
    if (!isRecord(candidate)) return undefined;
    if (isConfigLike(candidate)) return candidate;
    if (isConfigLike(candidate.config)) return candidate.config;
    candidate = candidate.default;
  }
  return undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isConfigLike(value: unknown): value is Pick<SoftureConfig, "database"> {
  return isRecord(value) && Array.isArray(value.modules) && "database" in value;
}

async function openDatabase<TArgs>(
  options: RunOpsScriptOptions<TArgs>,
): Promise<Ok<{ db: Database; close: () => Promise<void> }> | Problem> {
  if (options.database !== undefined) {
    return ok({ db: options.database, close: () => Promise.resolve() });
  }
  const database = options.config.database;
  if (database === null) {
    return problem("the config has no database; set database.url in softure.config");
  }
  try {
    const opened = await openCommandDatabase(database, { max: 1 });
    return ok({ db: opened.handle.db, close: opened.close });
  } catch (error) {
    return problem(`could not open the database: ${describeFailure(error)}`);
  }
}

const processInput: OpsInputReader = {
  readFile: (path) => readFile(path, "utf8"),
  readStdin: async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
    }
    return Buffer.concat(chunks).toString("utf8");
  },
};

/**
 * Replaces `--<key>-file` of each secret key with `<key>` read from the file or stdin. Messages name
 * the arguments and paths, never a value.
 */
async function readSecretArguments(
  secrets: readonly string[],
  values: Readonly<Record<string, string | true>>,
  reader: OpsInputReader,
): Promise<Ok<Record<string, string | true>> | Problem> {
  const resolved: Record<string, string | true> = { ...values };
  let hasReadStdin = false;
  for (const key of secrets) {
    const fileKey = `${key}${FILE_SUFFIX}`;
    const path = resolved[fileKey];
    if (path === undefined) continue;
    if (Object.hasOwn(resolved, key)) return problem(`--${key} and --${fileKey} are both given; use one`);
    if (path === true || path === "") return problem(`--${fileKey} needs a path, or ${STDIN_PATH} for stdin`);
    if (path === STDIN_PATH && hasReadStdin) return problem(`only one --<key>-file may read stdin`);
    let content: string;
    try {
      content = path === STDIN_PATH ? await reader.readStdin() : await reader.readFile(path);
    } catch {
      return problem(`--${fileKey}: cannot read ${path}`);
    }
    hasReadStdin ||= path === STDIN_PATH;
    delete resolved[fileKey];
    resolved[key] = content.replace(/\r?\n$/, "");
  }
  return ok(resolved);
}

function problem(message: string): Problem {
  return { ok: false, message };
}

function checkReport(name: string, report: OpsReport): void {
  // A result nobody measured is not printed as if it were one.
  if (report.before === undefined || report.after === undefined) {
    throw new Error(`ops script "${name}": run must return both before and after; nothing was written`);
  }
}

function formatUsage(script: Pick<OpsScript<never>, "name" | "description" | "usage" | "secrets">): string {
  return [
    `Usage: ${script.name} [arguments] [--commit]`,
    "",
    script.description,
    "",
    "Arguments:",
    ...script.usage.map((line) => `  ${line}`),
    ...(script.secrets ?? []).map((key) => `  --${key}-file=<path>  read --${key} from a file instead (- reads stdin)`),
    "  --commit    write the change; without it the script runs and rolls back (dry run)",
    "  --help      show this help",
  ].join("\n");
}

function formatIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.map(String).join(".");
  return path === "" ? issue.message : `--${path}: ${issue.message}`;
}

function formatState(state: unknown): string {
  return JSON.stringify(state, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value));
}

/** The error message, except for database errors, whose message may carry query parameters. */
function describeFailure(error: unknown): string {
  if (safeError(error).error === "core.database_failed") {
    return `database error (${errorLogLabel(error)})`;
  }
  return error instanceof Error ? error.message : String(error);
}
