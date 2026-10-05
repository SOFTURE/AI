// The `softure-blog` bin. It loads the app's config through `@softure-ai/core/cli`, like
// `softure migrate` (@softure-ai/db): the file must be loadable by Node itself (`.js`/`.mjs`, or `.ts`
// where Node strips types). Anything else uses an app script with `runBlogCli` instead (see run.ts).
import { loadAppConfig, takeConfigOption } from "@softure-ai/core/cli";
import { BLOG_USAGE, EXIT_FAILED, EXIT_OK, EXIT_USAGE, parseBlogCommand, runBlogCli, type BlogCommand, type CliOutput } from "./run.js";

export interface RunBlogCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output?: CliOutput;
}

const APP_SCRIPT = { runner: "runBlogCli", packageName: "@softure-ai/blog" };

// The commands that never connect, so a CI job runs them with a config that has no database URL.
// Any other command (and a new one, until it is listed here) needs the database.
const COMMANDS_WITHOUT_DATABASE: ReadonlySet<BlogCommand["kind"]> = new Set(["check", "skill-install"]);

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Checks the arguments, loads the config and runs `runBlogCli`. A usage error never loads the config. */
export async function runBlogCommand(options: RunBlogCommandOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const taken = takeConfigOption(options.argv);
  if (!taken.ok) return refuseUsage(output, taken.problem);
  const command = parseBlogCommand(taken.argv);
  if (typeof command === "string") return refuseUsage(output, command);
  if (command.kind === "help") {
    output.log(BLOG_USAGE);
    return EXIT_OK;
  }

  const database = COMMANDS_WITHOUT_DATABASE.has(command.kind) ? "optional" : "required";
  const loaded = await loadAppConfig({ cwd: options.cwd, configPath: taken.configPath, appScript: APP_SCRIPT, database });
  if (!loaded.ok) {
    output.error(`softure-blog: ${loaded.problem}`);
    return EXIT_FAILED;
  }
  return runBlogCli({ config: loaded.config, argv: taken.argv, cwd: options.cwd, output });
}

function refuseUsage(output: CliOutput, problem: string): number {
  output.error(`softure-blog: ${problem}`);
  output.error(BLOG_USAGE);
  return EXIT_USAGE;
}
