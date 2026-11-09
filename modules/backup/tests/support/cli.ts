// Runs the command line in-process, collecting its output.
import { runCli, type CliIo } from "../../src/cli/run.js";

export interface CliResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export async function runBackupCli(args: string[], options: { cwd: string; env: Record<string, string | undefined>; stdin?: string; now?: Date }): Promise<CliResult> {
  let stdout = "";
  let stderr = "";
  const io: CliIo = {
    cwd: options.cwd,
    env: options.env,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
    readStdin: () => Promise.resolve(options.stdin ?? ""),
    ...(options.now === undefined ? {} : { now: () => options.now as Date }),
  };
  const status = await runCli(args, io);
  return { status, stdout, stderr };
}
