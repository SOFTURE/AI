// The `softure-connections` bin. It loads the app's config through `@softure-ai/core/cli`, like `softure-mcp`
// (@softure-ai/mcp-access): the file must be loadable by Node itself (`.js`/`.mjs`, or `.ts` where Node strips
// types). Anything else uses an app script with `runConnectionsCli` instead (see run.ts).
import { loadAppConfig, takeConfigOption } from "@softure-ai/core/cli";
import { CONNECTIONS_USAGE, EXIT_FAILED, EXIT_USAGE, runConnectionsCli, type CliOutput } from "./run.js";

export interface RunConnectionsCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output?: CliOutput;
}

const APP_SCRIPT = { runner: "runConnectionsCli", packageName: "@softure-ai/connections" };

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Loads the config (only `rotate-keys` needs one) and runs `runConnectionsCli`. */
export async function runConnectionsCommand(options: RunConnectionsCommandOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const taken = takeConfigOption(options.argv);
  if (!taken.ok) {
    output.error(`softure-connections: ${taken.problem}`);
    output.error(CONNECTIONS_USAGE);
    return EXIT_USAGE;
  }
  const { configPath, argv } = taken;
  if (argv[0] !== "rotate-keys") return runConnectionsCli({ argv, output });

  const loaded = await loadAppConfig({ cwd: options.cwd, configPath, appScript: APP_SCRIPT });
  if (!loaded.ok) {
    output.error(`softure-connections: ${loaded.problem}`);
    return EXIT_FAILED;
  }
  return runConnectionsCli({ config: loaded.config, argv, output });
}
