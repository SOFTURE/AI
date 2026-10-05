import { runEnvRender } from "./env-command.js";
import { CliFailure, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { runReleaseNotes } from "./release-notes-command.js";
import { runVerifyCommand } from "./verify-command.js";

export const USAGE = [
  "Usage: softure-deploy <command> [flags]",
  "",
  "  env render [--compose=docker/prod/docker-compose.yml] [--out=.env.prod]",
  "      writes the env file from the environment for every ${NAME:?} of the compose file; prints names only",
  "  release-notes [--to=HEAD] [--from=<tag>] [--match=<glob>] [--repo-url=<url>] [--locale=en|pl] [--out=<file>]",
  "      the release report since the previous tag matching --match (default *)",
  "  help",
  "",
].join("\n");

type Command = (args: string[], io: CliIo) => void | Promise<void>;

/** Commands by their words; later items (backup, schema-guard, verify, init) add their own entries. */
const COMMANDS: Record<string, Command> = {
  "env render": runEnvRender,
  "release-notes": runReleaseNotes,
  verify: runVerifyCommand,
};

function findCommand(argv: string[]): { command: Command; args: string[] } | null {
  for (const [words, command] of Object.entries(COMMANDS)) {
    const parts = words.split(" ");
    if (parts.every((part, index) => argv[index] === part)) return { command, args: argv.slice(parts.length) };
  }
  return null;
}

/** Runs one command and returns the process exit code; expected failures are one line on stderr. */
export async function runCli(argv: string[], io: CliIo): Promise<number> {
  if (argv.length === 0 || ["help", "--help", "-h"].includes(argv[0] ?? "")) {
    io.stdout(USAGE);
    return argv.length === 0 ? USAGE_EXIT_CODE : 0;
  }
  const found = findCommand(argv);
  if (found === null) {
    io.stderr(`softure-deploy: unknown command "${argv.join(" ")}".\n\n${USAGE}`);
    return USAGE_EXIT_CODE;
  }
  try {
    await found.command(found.args, io);
    return 0;
  } catch (error) {
    if (!(error instanceof CliFailure)) throw error;
    io.stderr(`${error.message}\n`);
    return error.exitCode;
  }
}
