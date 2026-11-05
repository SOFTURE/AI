import { resolve } from "node:path";

/** What a failed ffmpeg step ran and printed, enough for a person to run it again (`writeFfmpegFailure`). */
export interface FfmpegFailure {
  /** The step's name, as the thrown error starts. */
  step: string;
  /** Exactly the arguments ffmpeg was spawned with, `-progress` included. */
  args: string[];
  /** The folder ffmpeg ran in (the process's own when the step set none). */
  cwd: string;
  /** The exit code; null when ffmpeg did not start or was killed by a signal. */
  code: number | null;
  signal: string | null;
  /** The whole stderr, line by line (its last `FFMPEG_FAILURE_STDERR_LINES` lines on a very long run). */
  stderr: string[];
  /** Every `-i` input: files resolved against `cwd`, `lavfi` sources as they are. */
  inputs: string[];
}

/** How many stderr lines a failure keeps at most (the last ones). */
export const FFMPEG_FAILURE_STDERR_LINES = 2000;

/** Every `-i` input of an ffmpeg command: files resolved against `cwd`; a `-f lavfi` source is not a file, kept as it is. */
export function findFfmpegInputs(args: readonly string[], cwd: string): string[] {
  const inputs: string[] = [];
  let format: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === "-f" && value !== undefined) format = value;
    if (arg !== "-i" || value === undefined) continue;
    inputs.push(format === "lavfi" ? value : resolve(cwd, value));
    format = null;
  }
  return inputs;
}

const SAFE_SHELL_ARGUMENT = /^[\w@%+=:,./-]+$/;

/** One argument for a POSIX shell: as it is when it needs no quoting, otherwise in single quotes. */
export function quoteShellArgument(value: string): string {
  if (SAFE_SHELL_ARGUMENT.test(value)) return value;
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

/** The command as one shell line: `ffmpeg` and every argument, quoted where needed. */
export function formatFfmpegCommand(args: readonly string[]): string {
  return ["ffmpeg", ...args.map(quoteShellArgument)].join(" ");
}

/**
 * A filter graph's chains, split at each top-level `;`: a `;` escaped with `\` or inside single quotes (a captions
 * path, a drawtext string) stays in its chain. Joined with `;` they give the graph back. ffmpeg skips whitespace
 * between chains, so a graph file with one chain per line reads as the graph.
 */
export function splitFilterGraph(graph: string): string[] {
  const chains: string[] = [];
  let chain = "";
  let isQuoted = false;
  for (let index = 0; index < graph.length; index += 1) {
    const char = graph[index] ?? "";
    // Inside single quotes every character is literal, a backslash too.
    if (char === "\\" && !isQuoted && index + 1 < graph.length) {
      chain += char + (graph[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (char === "'") isQuoted = !isQuoted;
    if (char === ";" && !isQuoted) {
      chains.push(chain);
      chain = "";
      continue;
    }
    chain += char;
  }
  chains.push(chain);
  return chains;
}
