import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { findShortValues, renderEnvFile, type MinLength } from "../env/env-file.js";
import { findComposeNames } from "../env/required-names.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags } from "./options.js";

export const DEFAULT_COMPOSE_FILE = "docker/prod/docker-compose.yml";
export const DEFAULT_ENV_FILE = ".env.prod";

/** Owner read and write only: the file holds production secrets. */
const ENV_FILE_MODE = 0o600;

function readCompose(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown error";
    return fail(`env render: cannot read the compose file ${path} (${code}).`);
  }
}

/** Writes through a temporary file, so a crash never leaves a half-written `.env.prod`. */
function writeSecretFile(path: string, text: string): void {
  const temporary = `${path}.${process.pid}.tmp`;
  // `mode` applies only to a new file, so a leftover temporary file is removed and `wx` refuses to reuse one.
  rmSync(temporary, { force: true });
  writeFileSync(temporary, text, { mode: ENV_FILE_MODE, flag: "wx" });
  renameSync(temporary, path);
}

/**
 * The values `env render` writes from: the environment, or with `--from-json-env` only the JSON objects in those
 * variables (e.g. `toJSON(secrets)` and `toJSON(vars)`), later ones winning. Non-string values are left out, so they
 * count as missing. A failure names the variable, never a value.
 */
function readRenderValues(names: readonly string[], env: CliIo["env"]): Record<string, string | undefined> {
  if (names.length === 0) return { ...env };
  const values: Record<string, string> = {};
  for (const name of names) {
    const text = env[name];
    if (text === undefined || text === "") fail(`env render: ${name} is not set; --from-json-env names a variable holding a JSON object.`);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Reported below without echoing the text.
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      fail(`env render: ${name} is not a JSON object of names and values.`);
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") values[key] = value;
    }
  }
  return values;
}

const MIN_LENGTH_SPEC = /^([A-Za-z_][A-Za-z0-9_]*)=([1-9][0-9]{0,3})$/;

/** `--min-length NAME=N` values, each naming a variable of the compose file; anything else is a usage error. */
function parseMinLengths(specs: readonly string[], composeNames: ReadonlySet<string>): MinLength[] {
  return specs.map((spec) => {
    const match = MIN_LENGTH_SPEC.exec(spec);
    if (!match?.[1] || !match[2]) {
      return fail(`env render: --min-length=${spec} is not NAME=<length>, a length from 1 to 9999.`, USAGE_EXIT_CODE);
    }
    if (!composeNames.has(match[1])) {
      return fail(`env render: --min-length names ${match[1]}, which the compose file does not use.`, USAGE_EXIT_CODE);
    }
    return { name: match[1], min: Number(match[2]) };
  });
}

/**
 * `softure-deploy env render [--compose=…] [--out=…] [--from-json-env=NAME…]`: `.env.prod` from the environment (or
 * the JSON objects `--from-json-env` names), for every required name of the compose file and every optional one
 * (`${NAME:-…}`) the values set. Prints names and counts only, never a value.
 */
export function runEnvRender(args: string[], io: CliIo): void {
  const flags = readFlags("env render", args, {
    compose: { type: "string", default: DEFAULT_COMPOSE_FILE },
    out: { type: "string", default: DEFAULT_ENV_FILE },
    "from-json-env": { type: "string", multiple: true, default: [] },
    "min-length": { type: "string", multiple: true, default: [] },
  });
  const composePath = resolve(io.cwd, flags.compose);
  const outPath = resolve(io.cwd, flags.out);
  const { required, optional } = findComposeNames(readCompose(composePath));
  if (required.length === 0 && optional.length === 0) {
    fail(`env render: ${flags.compose} has no required (\${NAME:?…}) or optional (\${NAME:-…}) variable; nothing to render.`);
  }
  const minLengths = parseMinLengths(flags["min-length"], new Set([...required.map(({ name }) => name), ...optional]));
  const jsonSources = flags["from-json-env"];
  const env = readRenderValues(jsonSources, io.env);
  const result = renderEnvFile({ names: required, optional, env });
  const short = findShortValues({ minLengths, env });
  if (!result.ok || short.length > 0) {
    const problems = [];
    const source = jsonSources.length === 0 ? "the environment" : jsonSources.join(", ");
    if (!result.ok && result.missing.length > 0) problems.push(`missing in ${source}: ${result.missing.join(", ")}`);
    if (!result.ok && result.unsafe.length > 0) {
      problems.push(`no literal one-line form (a newline or a single quote): ${result.unsafe.join(", ")}`);
    }
    if (short.length > 0) problems.push(`shorter than the --min-length: ${short.join(", ")}`);
    fail(`env render: ${flags.out} not written; ${problems.join("; ")}.`);
  }
  writeSecretFile(outPath, result.text);
  const optionalCount = optional.length === 0 ? "" : ` (${result.optional.length} of ${optional.length} optional set)`;
  io.stdout(
    `env render: wrote ${result.names.length} names${optionalCount} from ${flags.compose} to ${flags.out}: ${result.names.join(", ")}\n`,
  );
}
