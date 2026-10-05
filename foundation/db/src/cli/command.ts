// The `softure` bin: `softure migrate [--config <file>] [options]`. It loads the app's config through
// `@softure-ai/core/cli`, so the file must be loadable by Node itself: `.js`/`.mjs`, or `.ts` where
// Node strips types (Node >= 22.18; relative imports then need `.ts` extensions). Anything else
// uses an app script with `runMigrateCli` instead (see run.ts).
import { loadAppConfig, takeConfigOption } from "@softure-ai/core/cli";
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, MIGRATE_USAGE, runMigrateCli, type CliOutput } from "./run.js";

export interface RunSoftureCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output?: CliOutput;
}

const APP_SCRIPT = { runner: "runMigrateCli", packageName: "@softure-ai/db" };

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

export async function runSoftureCommand(options: RunSoftureCommandOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const [command, ...rest] = options.argv;
  if (command !== "migrate") {
    output.error(command === undefined ? "softure: missing command" : `softure: unknown command "${command}"`);
    output.error("Commands: migrate");
    output.error(MIGRATE_USAGE);
    return EXIT_USAGE;
  }

  if (rest.includes("--help")) {
    output.log(MIGRATE_USAGE);
    return EXIT_OK;
  }
  const taken = takeConfigOption(rest);
  if (!taken.ok) {
    output.error(`softure migrate: ${taken.problem}`);
    output.error(MIGRATE_USAGE);
    return EXIT_USAGE;
  }
  const loaded = await loadAppConfig({ cwd: options.cwd, configPath: taken.configPath, appScript: APP_SCRIPT });
  if (!loaded.ok) {
    output.error(`softure: ${loaded.problem}`);
    return EXIT_FAILED;
  }
  return runMigrateCli({ config: loaded.config, argv: taken.argv, cwd: options.cwd, output });
}
