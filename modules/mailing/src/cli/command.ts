// The `softure-mail` bin. It loads the app's config through `@softure-ai/core/cli`, like
// `softure migrate` (@softure-ai/db): the file must be loadable by Node itself (`.js`/`.mjs`, or `.ts`
// where Node strips types). Anything else uses an app script with `runMailCli` instead (see run.ts).
import { loadAppConfig, takeConfigOption } from "@softure-ai/core/cli";
import { EXIT_FAILED, EXIT_USAGE, MAIL_USAGE, runMailCli, type CliOutput } from "./run.js";

export interface RunMailCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output?: CliOutput;
}

const APP_SCRIPT = { runner: "runMailCli", packageName: "@softure-ai/mailing" };

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Loads the config (unless the command needs none) and runs `runMailCli`. */
export async function runMailCommand(options: RunMailCommandOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const taken = takeConfigOption(options.argv);
  if (!taken.ok) {
    output.error(`softure-mail: ${taken.problem}`);
    output.error(MAIL_USAGE);
    return EXIT_USAGE;
  }
  const { configPath, argv } = taken;
  if (!needsConfig(argv) && configPath === undefined) return runMailCli({ argv, cwd: options.cwd, output });

  const loaded = await loadAppConfig({ cwd: options.cwd, configPath, appScript: APP_SCRIPT });
  if (!loaded.ok) {
    output.error(`softure-mail: ${loaded.problem}`);
    return EXIT_FAILED;
  }
  return runMailCli({ config: loaded.config, argv, cwd: options.cwd, output });
}

/** `dns --domain` and help need no config; everything else reads it. */
function needsConfig(argv: readonly string[]): boolean {
  if (argv.length === 0 || argv.includes("--help")) return false;
  return !(argv[0] === "dns" && argv.some((arg) => arg === "--domain" || arg.startsWith("--domain=")));
}
