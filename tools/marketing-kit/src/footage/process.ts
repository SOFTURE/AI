import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * Child processes of the footage blocks (ffmpeg, ffprobe, hyperframes), run without blocking the event loop, so a jobs
 * worker keeps its lease heartbeat during a long normalize or render. An abort kills the child, removes the partial
 * files it was writing and rejects with the signal's reason, as `fetch` does.
 */

export interface ProcessOptions {
  command: string;
  args: string[];
  signal?: AbortSignal;
  /** Files the child writes; removed when the run is aborted. */
  removeOnAbort?: string[];
  /** Each line the child prints on stdout; without it stdout is collected and returned. */
  onStdoutLine?: (line: string) => void;
  /** Each line the child prints on stderr; without it stderr is collected and returned. */
  onStderrLine?: (line: string) => void;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export type ProcessOutcome =
  | { kind: "exited"; code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }
  | { kind: "not-started"; error: string };

/** Splits a stream into lines, handing each finished line on and keeping the rest for the next chunk. */
function createLineSplitter(onLine: (line: string) => void): { push: (chunk: string) => void; end: () => void } {
  let rest = "";
  return {
    push(chunk) {
      const lines = (rest + chunk).split(/\r?\n|\r/);
      rest = lines.pop() ?? "";
      for (const line of lines) onLine(line);
    },
    end() {
      if (rest.length > 0) onLine(rest);
      rest = "";
    },
  };
}

function removeFiles(paths: string[]): void {
  for (const path of paths) rmSync(path, { recursive: true, force: true });
}

/**
 * Runs a child process to its end. Resolves with how it ended (a failure to start is a value too); rejects only when
 * `signal` aborts, after the child is killed and `removeOnAbort` removed.
 */
export function runProcess(options: ProcessOptions): Promise<ProcessOutcome> {
  const { signal } = options;
  if (signal?.aborted === true) {
    removeFiles(options.removeOnAbort ?? []);
    return Promise.reject(signal.reason as Error);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, { cwd: options.cwd, env: options.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const out = createLineSplitter((line) => options.onStdoutLine?.(line));
    const err = createLineSplitter((line) => options.onStderrLine?.(line));
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      if (options.onStdoutLine === undefined) stdout += chunk;
      else out.push(chunk);
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      if (options.onStderrLine === undefined) stderr += chunk;
      else err.push(chunk);
    });
    let isAborted = false;
    const onAbort = (): void => {
      isAborted = true;
      child.kill("SIGKILL");
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    let startError: string | null = null;
    child.on("error", (error) => {
      startError = error.message;
    });
    child.on("close", (code, exitSignal) => {
      signal?.removeEventListener("abort", onAbort);
      out.end();
      err.end();
      if (isAborted && signal !== undefined) {
        removeFiles(options.removeOnAbort ?? []);
        reject(signal.reason as Error);
        return;
      }
      if (startError !== null) {
        resolve({ kind: "not-started", error: startError });
        return;
      }
      resolve({ kind: "exited", code, signal: exitSignal, stdout, stderr });
    });
  });
}

/** Seconds ffmpeg has written so far, from a `-progress` line (`out_time_us=…`); null for any other line. */
export function readFfmpegProgressSeconds(line: string): number | null {
  const match = /^out_time_us=(\d+)$/.exec(line.trim());
  return match === null ? null : Number(match[1]) / 1_000_000;
}

export interface FfmpegRunOptions {
  signal?: AbortSignal;
  /** The file the run writes, removed on abort. */
  output?: string;
  /** Seconds of output written so far, as ffmpeg reports them. */
  onSeconds?: (seconds: number) => void;
}

/** Runs ffmpeg with its progress on stdout; throws naming the step when it fails (a broken input or machine). */
export async function runFfmpeg(step: string, args: string[], options: FfmpegRunOptions = {}): Promise<void> {
  const errors: string[] = [];
  const outcome = await runProcess({
    command: "ffmpeg",
    args: ["-progress", "pipe:1", "-nostats", ...args],
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    removeOnAbort: options.output === undefined ? [] : [options.output],
    onStdoutLine: (line) => {
      const seconds = readFfmpegProgressSeconds(line);
      if (seconds !== null) options.onSeconds?.(seconds);
    },
    onStderrLine: (line) => {
      if (line.trim().length > 0) errors.push(line);
    },
  });
  if (outcome.kind === "not-started") throw new Error(`${step}: ffmpeg did not start (${outcome.error}).`);
  if (outcome.code !== 0) {
    const detail = errors.slice(-5).join(" | ");
    throw new Error(`${step}: ffmpeg ended with code ${String(outcome.code)} (signal ${outcome.signal ?? "-"})${detail.length > 0 ? `: ${detail}` : ""}.`);
  }
}
