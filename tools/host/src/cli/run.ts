import { runAppAdd } from "./app-add-command.js";
import { createHostDeps, type HostDeps } from "./context.js";
import { CliFailure, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { runServer } from "./server-command.js";

export const USAGE = [
  "Usage: softure-host <command> [flags]",
  "",
  "  server --inventory=<file> [--check] [--connect-as=<user>]",
  "      provisions or converges the shared app server: softure.vps_foundation's bootstrap (hardening, UFW, fail2ban,",
  "      Docker), the deploy user, the Traefik edge and the Cloudflare-only origin firewall; --connect-as logs in as a",
  "      provider's first user (root, ubuntu) on a fresh server",
  "  app add --inventory=<file> --app=<slug> [--check] [--rotate-key]",
  "      onboards one app of the inventory: GitHub Environment production with the v* tag policy, the app folder, the",
  "      first deploy.sh and its release key line on the server, the deploy secrets (database passwords only when",
  "      missing), Cloudflare DNS, TLS check and Access with CLOUDFLARE_API_TOKEN; --rotate-key issues a new key",
  "  help",
  "",
  "--check changes nothing: Ansible runs in check mode, GitHub and Cloudflare are only read.",
  "",
].join("\n");

type Command = (args: string[], io: CliIo, deps: HostDeps) => Promise<void>;

const COMMANDS: Record<string, Command> = {
  server: runServer,
  "app add": runAppAdd,
};

function findCommand(argv: string[]): { command: Command; args: string[] } | null {
  for (const [words, command] of Object.entries(COMMANDS)) {
    const parts = words.split(" ");
    if (parts.every((part, index) => argv[index] === part)) return { command, args: argv.slice(parts.length) };
  }
  return null;
}

/** Runs one command and returns the process exit code; expected failures are one message on stderr. */
export async function runCli(argv: string[], io: CliIo, deps?: HostDeps): Promise<number> {
  if (argv.length === 0 || ["help", "--help", "-h"].includes(argv[0] ?? "")) {
    io.stdout(USAGE);
    return argv.length === 0 ? USAGE_EXIT_CODE : 0;
  }
  const found = findCommand(argv);
  if (found === null) {
    io.stderr(`softure-host: unknown command "${argv.join(" ")}".\n\n${USAGE}`);
    return USAGE_EXIT_CODE;
  }
  try {
    await found.command(found.args, io, deps ?? createHostDeps(io));
    return 0;
  } catch (error) {
    if (!(error instanceof CliFailure)) throw error;
    io.stderr(`${error.message}\n`);
    return error.exitCode;
  }
}
