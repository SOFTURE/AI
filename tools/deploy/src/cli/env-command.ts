import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderEnvFile } from "../env/env-file.js";
import { findRequiredNames } from "../env/required-names.js";
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

/**
 * `softure-deploy env render [--compose=…] [--out=…]`: `.env.prod` from the environment, for every required name
 * of the compose file. Prints names and counts only, never a value.
 */
export function runEnvRender(args: string[], io: CliIo): void {
  const flags = readFlags("env render", args, {
    compose: { type: "string", default: DEFAULT_COMPOSE_FILE },
    out: { type: "string", default: DEFAULT_ENV_FILE },
  });
  const composePath = resolve(io.cwd, flags.compose);
  const outPath = resolve(io.cwd, flags.out);
  const names = findRequiredNames(readCompose(composePath));
  if (names.length === 0) {
    fail(`env render: ${flags.compose} has no required variable (\${NAME:?…}); nothing to render.`);
  }
  const result = renderEnvFile({ names, env: io.env });
  if (!result.ok) {
    const problems = [];
    if (result.missing.length > 0) problems.push(`missing in the environment: ${result.missing.join(", ")}`);
    if (result.unsafe.length > 0) {
      problems.push(`no literal one-line form (a newline or a single quote): ${result.unsafe.join(", ")}`);
    }
    fail(`env render: ${flags.out} not written; ${problems.join("; ")}.`);
  }
  writeSecretFile(outPath, result.text);
  io.stdout(`env render: wrote ${result.names.length} names from ${flags.compose} to ${flags.out}: ${result.names.join(", ")}\n`);
}
