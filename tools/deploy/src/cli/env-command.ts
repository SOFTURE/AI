import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderEnvFile } from "../env/env-file.js";
import { mergeJsonValues, type JsonValuesSource } from "../env/json-values.js";
import { findComposeNames } from "../env/required-names.js";
import { fail } from "./failure.js";
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

/** The values to render: the environment, or only the JSON objects `--secrets-json` and `--vars-json` name. */
function readValues(io: CliIo, secretsJson: string | undefined, varsJson: string | undefined): Readonly<Record<string, string | undefined>> {
  const sources: JsonValuesSource[] = [];
  for (const variable of [secretsJson, varsJson]) {
    if (variable !== undefined) sources.push({ variable, text: io.env[variable] });
  }
  if (sources.length === 0) return io.env;
  const merged = mergeJsonValues(sources);
  if (!merged.ok) return fail(`env render: nothing written; ${merged.problem}.`);
  if (merged.overridden.length > 0) {
    io.stdout(`env render: ${merged.overridden.join(", ")} taken from ${varsJson ?? ""} over ${secretsJson ?? ""}.\n`);
  }
  return merged.values;
}

/**
 * `softure-deploy env render [--compose=…] [--out=…] [--secrets-json=<VAR>] [--vars-json=<VAR>]`: `.env.prod` from
 * the environment (or only from the JSON objects those variables hold, vars over secrets), for every required name
 * of the compose file and every optional one (`${NAME:-…}`) set. Prints names and counts only, never a value.
 */
export function runEnvRender(args: string[], io: CliIo): void {
  const flags = readFlags("env render", args, {
    compose: { type: "string", default: DEFAULT_COMPOSE_FILE },
    out: { type: "string", default: DEFAULT_ENV_FILE },
    "secrets-json": { type: "string" },
    "vars-json": { type: "string" },
  });
  const values = readValues(io, flags["secrets-json"], flags["vars-json"]);
  const composePath = resolve(io.cwd, flags.compose);
  const outPath = resolve(io.cwd, flags.out);
  const { required, optional } = findComposeNames(readCompose(composePath));
  if (required.length === 0 && optional.length === 0) {
    fail(`env render: ${flags.compose} has no required (\${NAME:?…}) or optional (\${NAME:-…}) variable; nothing to render.`);
  }
  const result = renderEnvFile({ names: required, optional, env: values });
  if (!result.ok) {
    const problems = [];
    if (result.missing.length > 0) problems.push(`missing in the ${values === io.env ? "environment" : "JSON values"}: ${result.missing.join(", ")}`);
    if (result.unsafe.length > 0) {
      problems.push(`no literal one-line form (a newline or a single quote): ${result.unsafe.join(", ")}`);
    }
    fail(`env render: ${flags.out} not written; ${problems.join("; ")}.`);
  }
  writeSecretFile(outPath, result.text);
  const optionalCount = optional.length === 0 ? "" : ` (${result.optional.length} of ${optional.length} optional set)`;
  io.stdout(
    `env render: wrote ${result.names.length} names${optionalCount} from ${flags.compose} to ${flags.out}: ${result.names.join(", ")}\n`,
  );
}
