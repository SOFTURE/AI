// `softure-connections`: the module's maintenance command.
// - `key [id]` prints a new keyring entry for `SOFTURE_CONNECTIONS_KEYS` (no config, no database);
// - `rotate-keys [--commit]` re-seals every stored secret under the keyring's first key (`reencryptConnections`);
//   a dry run by default, which only counts.
// The app passes its validated config, so the same function serves the bin and an app script a bundler packs:
//
//   // scripts/connections.ts
//   import { runConnectionsCli } from "@softure-ai/connections/cli";
//   import config from "../softure.config";
//   process.exitCode = await runConnectionsCli({ config, argv: process.argv.slice(2) });
import { errorLogLabel, systemClock, type Clock, type SoftureConfig, type SoftureDatabaseConfig } from "@softure-ai/core";
import { openCommandDatabase, type CommandDatabase } from "@softure-ai/db";
import { generateConnectionsKey, type Env } from "../server/crypto.js";
import { reencryptConnections } from "../server/rotate.js";

export interface CliOutput {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
}

export interface RunConnectionsCliOptions {
  /** The app's config; `key` and help need none. */
  readonly config?: SoftureConfig;
  /** The arguments after the executable, e.g. `["rotate-keys", "--commit"]`. */
  readonly argv: readonly string[];
  readonly output?: CliOutput;
  /** Default: the wall clock. */
  readonly clock?: Clock;
  /** Default: `process.env` (the keyring). */
  readonly env?: Env;
  /** Default: the config's `database.handle`, else a connection on `database.url`. */
  readonly openDatabase?: (database: SoftureDatabaseConfig) => Promise<CommandDatabase>;
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

export const CONNECTIONS_USAGE = `Usage:
  softure-connections key [id]                prints a new SOFTURE_CONNECTIONS_KEYS entry, <id>:<key>
  softure-connections rotate-keys [--commit]  re-seals stored secrets under the first key (dry run without --commit)`;

const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Runs one command and answers its exit code. */
export async function runConnectionsCli(options: RunConnectionsCliOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const [command, ...rest] = options.argv;
  if (command === undefined || command === "--help" || command === "help") {
    output.log(CONNECTIONS_USAGE);
    return EXIT_OK;
  }
  if (command === "key") return printKey(rest, output);
  if (command === "rotate-keys") return rotateKeys(options, rest, output);
  output.error(`softure-connections: unknown command "${command}"`);
  output.error(CONNECTIONS_USAGE);
  return EXIT_USAGE;
}

function printKey(rest: readonly string[], output: CliOutput): number {
  const [id, extra] = rest;
  if (extra !== undefined || (id !== undefined && !KEY_ID_PATTERN.test(id))) {
    output.error("softure-connections key: the id must be 1 to 32 letters, digits, _ or -");
    return EXIT_USAGE;
  }
  // stdout carries only the entry, so it can be piped into a secret store.
  output.log(id === undefined ? generateConnectionsKey() : generateConnectionsKey(id));
  return EXIT_OK;
}

async function rotateKeys(options: RunConnectionsCliOptions, rest: readonly string[], output: CliOutput): Promise<number> {
  const unexpected = rest.find((argument) => argument !== "--commit");
  if (unexpected !== undefined) {
    output.error(`softure-connections rotate-keys: unexpected argument "${unexpected}"`);
    return EXIT_USAGE;
  }
  const dryRun = !rest.includes("--commit");
  const database = options.config?.database ?? null;
  if (options.config === undefined || database === null) {
    output.error("softure-connections rotate-keys: the config has no database; set database.url in softure.config");
    return EXIT_FAILED;
  }
  let opened: CommandDatabase | undefined;
  try {
    opened = await (options.openDatabase ?? ((settings) => openCommandDatabase(settings, { max: 1 })))(database);
    const result = await reencryptConnections(
      { db: opened.handle.db, clock: options.clock ?? systemClock, config: options.config, env: options.env ?? process.env },
      { dryRun },
    );
    if (!result.ok) {
      output.error(`softure-connections rotate-keys: ${result.error === "connections.key_missing" ? "SOFTURE_CONNECTIONS_KEYS is not set" : "SOFTURE_CONNECTIONS_KEYS is malformed"}`);
      return EXIT_FAILED;
    }
    const report = result.value;
    const verb = dryRun ? "would re-seal" : "re-sealed";
    output.log(
      `softure-connections rotate-keys: ${verb} ${String(report.connections)} connections under key "${report.currentKeyId}" and ${dryRun ? "would drop" : "dropped"} ${String(report.pendingAuthorizations)} pending authorizations${dryRun ? " (dry run; add --commit)" : ""}`,
    );
    for (const entry of report.unreadable) {
      output.error(`softure-connections rotate-keys: ${entry.provider}/${entry.accountId} cannot be opened (${entry.error}); connect it again`);
    }
    return report.unreadable.length === 0 ? EXIT_OK : EXIT_FAILED;
  } catch (error) {
    // The kind only: a driver message can carry the database address or credentials.
    output.error(`softure-connections rotate-keys: failed: ${errorLogLabel(error)}`);
    return EXIT_FAILED;
  } finally {
    await opened?.close();
  }
}
