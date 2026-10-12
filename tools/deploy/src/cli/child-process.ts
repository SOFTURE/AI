import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import { fail } from "./failure.js";
import type { CliIo } from "./io.js";

export interface ChildRun {
  readonly program: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  /** What the child reads; `null` lets it inherit this process's stdin. */
  readonly input: Readable | null;
}

/** Runs a program with an argument list (no shell), streams its output through `io` and returns its exit status. */
export async function runChild(run: ChildRun, io: CliIo): Promise<number> {
  const child = spawn(run.program, run.args, {
    cwd: io.cwd,
    env: run.env,
    stdio: [run.input === null ? "inherit" : "pipe", "pipe", "pipe"],
  });
  child.stdout?.setEncoding("utf8").on("data", (text: string) => io.stdout(text));
  child.stderr?.setEncoding("utf8").on("data", (text: string) => io.stderr(text));
  if (run.input !== null && child.stdin !== null) {
    // A child that stops reading early closes the pipe; that is its answer, not a failure here.
    child.stdin.on("error", () => undefined);
    run.input.pipe(child.stdin);
  }
  return new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => resolve(code ?? (signal === null ? 1 : 128)));
  }).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`cannot start ${run.program}: ${reason}`);
  });
}
