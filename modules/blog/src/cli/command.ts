// The `softure-blog` bin. It loads the app's config with a dynamic import, like `softure migrate`
// (@softure-ai/db): the file must be loadable by Node itself (`.js`/`.mjs`, or `.ts` where Node
// strips types). Anything else uses an app script with `runBlogCli` instead (see run.ts).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SoftureConfig } from "@softure-ai/core";
import { BLOG_USAGE, EXIT_FAILED, EXIT_OK, EXIT_USAGE, parseBlogCommand, runBlogCli, type CliOutput } from "./run.js";

export interface RunBlogCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output?: CliOutput;
}

const DEFAULT_CONFIG_FILES = ["softure.config.ts", "softure.config.mts", "softure.config.js", "softure.config.mjs"];

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Checks the arguments, loads the config and runs `runBlogCli`. A usage error never loads the config. */
export async function runBlogCommand(options: RunBlogCommandOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const taken = takeConfigOption(options.argv);
  if (typeof taken === "string") return refuseUsage(output, taken);
  const command = parseBlogCommand(taken.argv);
  if (typeof command === "string") return refuseUsage(output, command);
  if (command.kind === "help") {
    output.log(BLOG_USAGE);
    return EXIT_OK;
  }

  const path = taken.configPath === undefined ? findDefaultConfig(options.cwd) : resolve(options.cwd, taken.configPath);
  if (path === undefined) {
    output.error(`softure-blog: no config found; looked for ${DEFAULT_CONFIG_FILES.join(", ")} in ${options.cwd}; pass --config <file>`);
    return EXIT_FAILED;
  }
  const config = await loadConfig(path);
  if (typeof config === "string") {
    output.error(`softure-blog: ${config}`);
    return EXIT_FAILED;
  }
  return runBlogCli({ config, argv: taken.argv, cwd: options.cwd, output });
}

function refuseUsage(output: CliOutput, problem: string): number {
  output.error(`softure-blog: ${problem}`);
  output.error(BLOG_USAGE);
  return EXIT_USAGE;
}

function takeConfigOption(argv: readonly string[]): { configPath: string | undefined; argv: string[] } | string {
  const rest: string[] = [];
  let configPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--config") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) return "--config needs a file path";
      configPath = value;
      index += 1;
    } else if (arg.startsWith("--config=")) {
      configPath = arg.slice("--config=".length);
    } else {
      rest.push(arg);
    }
  }
  return { configPath, argv: rest };
}

function findDefaultConfig(cwd: string): string | undefined {
  return DEFAULT_CONFIG_FILES.map((name) => resolve(cwd, name)).find((path) => existsSync(path));
}

/** The config the file exports (default or `config`), or why it could not be used. */
async function loadConfig(path: string): Promise<SoftureConfig | string> {
  if (!existsSync(path)) return `config file ${path} does not exist`;
  let exported: { default?: unknown; config?: unknown };
  try {
    exported = (await import(pathToFileURL(path).href)) as { default?: unknown; config?: unknown };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `cannot load ${path}: ${reason}. If Node cannot run this file, call runBlogCli from an app script (see the @softure-ai/blog README).`;
  }
  const config = exported.default ?? exported.config;
  return isConfigLike(config) ? config : `${path} must export (default or as "config") the result of defineSoftureConfig`;
}

function isConfigLike(value: unknown): value is SoftureConfig {
  return typeof value === "object" && value !== null && "modules" in value && Array.isArray(value.modules) && "database" in value;
}
