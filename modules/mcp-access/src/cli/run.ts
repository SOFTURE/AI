// `softure-mcp`: the module's maintenance command. `prune` deletes expired access tokens and dead OAuth
// records (`pruneMcpAccess`), for a daily job such as a deploy `maintain` hook. The app passes its
// validated config, so the same function serves the bin and an app script a bundler packs:
//
//   // scripts/mcp.ts
//   import { runMcpAccessCli } from "@softure-ai/mcp-access/cli";
//   import config from "../softure.config";
//   process.exitCode = await runMcpAccessCli({ config, argv: process.argv.slice(2) });
import { errorLogLabel, systemClock, type Clock, type SoftureConfig, type SoftureDatabaseConfig } from "@softure-ai/core";
import { openCommandDatabase, type CommandDatabase } from "@softure-ai/db";
import { pruneMcpAccess } from "../server/prune.js";

export interface CliOutput {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
}

export interface RunMcpAccessCliOptions {
  /** The app's config; only help needs none. */
  readonly config?: SoftureConfig;
  /** The arguments after the executable, e.g. `["prune"]`. */
  readonly argv: readonly string[];
  readonly output?: CliOutput;
  /** Default: the wall clock. */
  readonly clock?: Clock;
  /** Default: the config's `database.handle`, else a connection on `database.url`. */
  readonly openDatabase?: (database: SoftureDatabaseConfig) => Promise<CommandDatabase>;
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

export const MCP_ACCESS_USAGE = `Usage:
  softure-mcp prune    deletes expired access tokens, authorization codes, grants and abandoned clients`;

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Runs one command and answers its exit code. */
export async function runMcpAccessCli(options: RunMcpAccessCliOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const [command, ...rest] = options.argv;
  if (command === undefined || command === "--help" || command === "help") {
    output.log(MCP_ACCESS_USAGE);
    return EXIT_OK;
  }
  if (command !== "prune" || rest.length > 0) {
    output.error(command === "prune" ? `softure-mcp prune: unexpected argument "${rest[0] ?? ""}"` : `softure-mcp: unknown command "${command}"`);
    output.error(MCP_ACCESS_USAGE);
    return EXIT_USAGE;
  }
  return prune(options, output);
}

async function prune(options: RunMcpAccessCliOptions, output: CliOutput): Promise<number> {
  const database = options.config?.database ?? null;
  if (options.config === undefined || database === null) {
    output.error("softure-mcp prune: the config has no database; set database.url in softure.config");
    return EXIT_FAILED;
  }
  let opened: CommandDatabase | undefined;
  try {
    opened = await (options.openDatabase ?? ((settings) => openCommandDatabase(settings, { max: 1 })))(database);
    const removed = await pruneMcpAccess({ db: opened.handle.db, clock: options.clock ?? systemClock, config: options.config });
    output.log(
      `softure-mcp prune: removed ${String(removed.accessTokens)} access tokens, ${String(removed.codes)} authorization codes, ${String(removed.grants)} grants, ${String(removed.clients)} clients`,
    );
    return EXIT_OK;
  } catch (error) {
    // The kind only: a driver message can carry the database address or credentials.
    output.error(`softure-mcp prune: failed: ${errorLogLabel(error)}`);
    return EXIT_FAILED;
  } finally {
    await opened?.close();
  }
}
