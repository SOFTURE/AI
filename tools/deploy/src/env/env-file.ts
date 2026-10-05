import type { RequiredName } from "./required-names.js";

/**
 * `.env.prod` text for a compose env file, from the process environment. Values never leave this function except
 * inside the returned text: problems name the variable, not its value.
 */

export type RenderEnvResult =
  | { ok: true; text: string; names: string[] }
  /** `missing`: unset (or empty where the compose file refuses empty); `unsafe`: no literal one-line form. */
  | { ok: false; missing: string[]; unsafe: string[] };

export interface RenderEnvOptions {
  names: RequiredName[];
  env: Readonly<Record<string, string | undefined>>;
}

// Characters a compose env file reads literally without quotes (no `$` interpolation, no ` #` comment, no spaces).
const BARE_VALUE = /^[A-Za-z0-9_./:@+,=-]*$/;

/** The value as compose reads it back literally, or null when no single-line literal form exists. */
function quoteValue(value: string): string | null {
  if (BARE_VALUE.test(value)) return value;
  // A single-quoted value is taken literally by compose; it cannot hold a single quote or span lines.
  if (/['\r\n]/.test(value)) return null;
  return `'${value}'`;
}

export function renderEnvFile({ names, env }: RenderEnvOptions): RenderEnvResult {
  const missing: string[] = [];
  const unsafe: string[] = [];
  const lines: string[] = [];
  for (const { name, allowsEmpty } of names) {
    const value = env[name];
    if (value === undefined || (value === "" && !allowsEmpty)) {
      missing.push(name);
      continue;
    }
    const quoted = quoteValue(value);
    if (quoted === null) {
      unsafe.push(name);
      continue;
    }
    lines.push(`${name}=${quoted}`);
  }
  if (missing.length > 0 || unsafe.length > 0) return { ok: false, missing, unsafe };
  return { ok: true, text: lines.map((line) => `${line}\n`).join(""), names: names.map(({ name }) => name) };
}
