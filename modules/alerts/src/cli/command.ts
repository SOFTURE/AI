// The `softure-alerts` bin. It loads the app's config through `@softure-ai/core/cli`, like `softure-mail`: the file
// must be loadable by Node itself (`.js`/`.mjs`, or `.ts` where Node strips types). Anything else uses an app script
// with `runAlertsCli` instead (see run.ts). `test` needs no database connection.
import { loadAppConfig, takeConfigOption } from "@softure-ai/core/cli";
import { ALERTS_USAGE, EXIT_FAILED, EXIT_USAGE, runAlertsCli, type CliOutput } from "./run.js";

export interface RunAlertsCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output?: CliOutput;
}

const APP_SCRIPT = { runner: "runAlertsCli", packageName: "@softure-ai/alerts" };

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Loads the config (unless the command needs none) and runs `runAlertsCli`. */
export async function runAlertsCommand(options: RunAlertsCommandOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const taken = takeConfigOption(options.argv);
  if (!taken.ok) {
    output.error(`softure-alerts: ${taken.problem}`);
    output.error(ALERTS_USAGE);
    return EXIT_USAGE;
  }
  const { configPath, argv } = taken;
  if (argv[0] !== "test" || argv.includes("--help")) return runAlertsCli({ argv, output });

  const loaded = await loadAppConfig({ cwd: options.cwd, configPath, appScript: APP_SCRIPT, database: "optional" });
  if (!loaded.ok) {
    output.error(`softure-alerts: ${loaded.problem}`);
    return EXIT_FAILED;
  }
  return runAlertsCli({ config: loaded.config, argv, output });
}
