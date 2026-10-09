import type { RequiredName } from "./required-names.js";

/**
 * `.env.prod` text for a compose env file, from the process environment. Values never leave this function except
 * inside the returned text: problems name the variable, not its value.
 */

export type RenderEnvResult =
  /** `names`: every name written, in file order; `optional`: the optional ones among them. */
  | { ok: true; text: string; names: string[]; optional: string[] }
  /** `missing`: unset (or empty where the compose file refuses empty); `unsafe`: no literal one-line form. */
  | { ok: false; missing: string[]; unsafe: string[] };

export interface RenderEnvOptions {
  names: RequiredName[];
  /** Names written only when the environment holds a non-empty value; never reported missing. */
  optional?: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}

/** The first line of every rendered file: the file is an output, so a hand edit on the server is lost next release. */
export const ENV_FILE_HEADER = "# Written by softure-deploy env render from the deploy environment; do not edit on the server.";

// Characters a compose env file reads literally without quotes (no `$` interpolation, no ` #` comment, no spaces).
const BARE_VALUE = /^[A-Za-z0-9_./:@+,=-]*$/;

/** The value as compose reads it back literally, or null when no single-line literal form exists. */
function quoteValue(value: string): string | null {
  if (BARE_VALUE.test(value)) return value;
  // A single-quoted value is taken literally by compose; it cannot hold a single quote or span lines.
  if (/['\r\n]/.test(value)) return null;
  return `'${value}'`;
}

export function renderEnvFile({ names, optional = [], env }: RenderEnvOptions): RenderEnvResult {
  const missing: string[] = [];
  const unsafe: string[] = [];
  const lines = [ENV_FILE_HEADER];
  const written: string[] = [];
  /** Adds the line, or records the name as unsafe; true when written. */
  const write = (name: string, value: string): boolean => {
    const quoted = quoteValue(value);
    if (quoted === null) {
      unsafe.push(name);
      return false;
    }
    lines.push(`${name}=${quoted}`);
    written.push(name);
    return true;
  };
  for (const { name, allowsEmpty } of names) {
    const value = env[name];
    if (value === undefined || (value === "" && !allowsEmpty)) {
      missing.push(name);
      continue;
    }
    write(name, value);
  }
  const optionalWritten: string[] = [];
  for (const name of optional) {
    const value = env[name];
    if (value === undefined || value === "") continue;
    if (write(name, value)) optionalWritten.push(name);
  }
  if (missing.length > 0 || unsafe.length > 0) return { ok: false, missing, unsafe };
  return { ok: true, text: lines.map((line) => `${line}\n`).join(""), names: written, optional: optionalWritten };
}

/** A secret's shortest allowed length, from `env render --min-length NAME=N`. */
export interface MinLength {
  name: string;
  min: number;
}

/**
 * The `NAME (N)` of every value shorter than its minimum. An unset value is not checked here: a required one is
 * reported missing, an optional one is left out. Never returns a value.
 */
export function findShortValues(options: {
  minLengths: readonly MinLength[];
  env: Readonly<Record<string, string | undefined>>;
}): string[] {
  return options.minLengths
    .filter(({ name, min }) => {
      const value = options.env[name];
      return value !== undefined && value !== "" && value.length < min;
    })
    .map(({ name, min }) => `${name} (${min})`);
}
