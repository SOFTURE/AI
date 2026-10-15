import { spawn } from "node:child_process";
import { fail } from "./failure.js";
import type { CliIo } from "./io.js";

export interface CaptureResult {
  status: number;
  stdout: string;
  stderr: string;
}

/** Runs programs without a shell. Tests pass a fake that records the calls. */
export interface Runner {
  /** Runs a program and returns its output; `input` (a secret value, a JSON body) goes to its stdin only. */
  capture(program: string, args: readonly string[], input?: string): Promise<CaptureResult>;
  /** Runs a program with its output streamed to the terminal (Ansible) and returns its exit status. */
  stream(program: string, args: readonly string[], env?: Readonly<Record<string, string>>): Promise<number>;
}

function describeStartFailure(program: string, error: unknown): never {
  const reason = error instanceof Error ? error.message : String(error);
  return fail(`cannot start ${program}: ${reason}`);
}

/** The runner of the real CLI: child processes with this process's environment. */
export function createProcessRunner(io: CliIo): Runner {
  return {
    async capture(program, args, input) {
      const child = spawn(program, args, { cwd: io.cwd, env: io.env, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (text: string) => (stdout += text));
      child.stderr.setEncoding("utf8").on("data", (text: string) => (stderr += text));
      // A child that stops reading early closes the pipe; that is its answer, not a failure here.
      child.stdin.on("error", () => undefined);
      child.stdin.end(input ?? "");
      return new Promise<CaptureResult>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code) => resolve({ status: code ?? 1, stdout, stderr }));
      }).catch((error: unknown) => describeStartFailure(program, error));
    },
    async stream(program, args, env) {
      const child = spawn(program, args, { cwd: io.cwd, env: { ...io.env, ...env }, stdio: ["inherit", "pipe", "pipe"] });
      child.stdout?.setEncoding("utf8").on("data", (text: string) => io.stdout(text));
      child.stderr?.setEncoding("utf8").on("data", (text: string) => io.stderr(text));
      return new Promise<number>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code) => resolve(code ?? 1));
      }).catch((error: unknown) => describeStartFailure(program, error));
    },
  };
}
