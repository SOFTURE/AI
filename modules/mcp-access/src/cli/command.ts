// The `softure-mcp` bin. It loads the app's config through `@softure-ai/core/cli`, like `softure-mail`
// (@softure-ai/mailing): the file must be loadable by Node itself (`.js`/`.mjs`, or `.ts` where Node
// strips types). Anything else uses an app script with `runMcpAccessCli` instead (see run.ts).
import { loadAppConfig, takeConfigOption } from "@softure-ai/core/cli";
import { EXIT_FAILED, EXIT_USAGE, MCP_ACCESS_USAGE, runMcpAccessCli, type CliOutput } from "./run.js";

export interface RunMcpAccessCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output?: CliOutput;
}

const APP_SCRIPT = { runner: "runMcpAccessCli", packageName: "@softure-ai/mcp-access" };

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Loads the config (unless only help is asked for) and runs `runMcpAccessCli`. */
export async function runMcpAccessCommand(options: RunMcpAccessCommandOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const taken = takeConfigOption(options.argv);
  if (!taken.ok) {
    output.error(`softure-mcp: ${taken.problem}`);
    output.error(MCP_ACCESS_USAGE);
    return EXIT_USAGE;
  }
  const { configPath, argv } = taken;
  if (argv[0] !== "prune") return runMcpAccessCli({ argv, output });

  const loaded = await loadAppConfig({ cwd: options.cwd, configPath, appScript: APP_SCRIPT });
  if (!loaded.ok) {
    output.error(`softure-mcp: ${loaded.problem}`);
    return EXIT_FAILED;
  }
  return runMcpAccessCli({ config: loaded.config, argv, output });
}
