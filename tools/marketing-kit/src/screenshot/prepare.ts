import { spawnSync } from "node:child_process";

/**
 * `signIn.prepare`: the app's own command that creates and seeds the account the signed-in screenshots show, and
 * prints what the frames must show as `{data:key}`. Its output may hold the account's password, so it is parsed and
 * never echoed; its error stream goes to the terminal as the command writes it.
 */

/** A seed script that runs longer than this is stuck, not slow. */
const PREPARE_TIMEOUT_MS = 10 * 60_000;
/** Seed scripts print logs; the cap only stops a runaway one from filling memory. */
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

export type PrepareResult = { ok: true; data: Record<string, string> } | { ok: false; error: string };

/** The data from the last non-empty line of the output: a JSON object of strings or numbers. */
export function parsePrepareOutput(stdout: string): PrepareResult {
  const lastLine = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .at(-1);
  const expected = 'its last line of output must be a JSON object of strings or numbers, e.g. {"email": "demo@example.com", "total": "12,345"}';
  if (lastLine === undefined) return { ok: false, error: `signIn.prepare printed nothing; ${expected}` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(lastLine);
  } catch {
    // The line may hold a password, so the parse error, which quotes it, is not passed on.
    return { ok: false, error: `signIn.prepare's last line is not JSON; ${expected}` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false, error: `signIn.prepare's last line is not a JSON object; ${expected}` };
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") data[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) data[key] = String(value);
    else return { ok: false, error: `signIn.prepare's value "${key}" is not a string or a number; ${expected}` };
  }
  return { ok: true, data };
}

export interface RunPrepareOptions {
  /** The folder of marketing.json. */
  cwd: string;
  /** The app's address, handed to the command as MARKETING_BASE_URL. */
  baseUrl: string;
}

/** Runs the command (no shell) and reads its data; a failure names the exit, never the output. */
export function runPrepare(command: readonly [string, ...string[]], options: RunPrepareOptions): PrepareResult {
  const [program, ...args] = command;
  const result = spawnSync(program, args, {
    cwd: options.cwd,
    env: { ...process.env, MARKETING_BASE_URL: options.baseUrl },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    timeout: PREPARE_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  const shown = command.join(" ");
  if (result.error !== undefined) return { ok: false, error: `signIn.prepare (${shown}) could not run: ${result.error.message}` };
  if (result.status !== 0) return { ok: false, error: `signIn.prepare (${shown}) ended with code ${String(result.status ?? result.signal)}` };
  return parsePrepareOutput(result.stdout);
}
