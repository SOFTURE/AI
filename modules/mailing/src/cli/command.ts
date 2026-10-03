// The `softure-mail` bin. It loads the app's config with a dynamic import, like `softure migrate`
// (@softure-ai/db): the file must be loadable by Node itself (`.js`/`.mjs`, or `.ts` where Node
// strips types). Anything else uses an app script with `runMailCli` instead (see run.ts).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SoftureConfig } from "@softure-ai/core";
import { EXIT_FAILED, EXIT_USAGE, MAIL_USAGE, runMailCli, type CliOutput } from "./run.js";

export interface RunMailCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output?: CliOutput;
}

const DEFAULT_CONFIG_FILES = ["softure.config.ts", "softure.config.mts", "softure.config.js", "softure.config.mjs"];

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Loads the config (unless the command needs none) and runs `runMailCli`. */
export async function runMailCommand(options: RunMailCommandOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const taken = takeConfigOption(options.argv);
  if (typeof taken === "string") {
    output.error(`softure-mail: ${taken}`);
    output.error(MAIL_USAGE);
    return EXIT_USAGE;
  }
  const { configPath, argv } = taken;
  if (!needsConfig(argv) && configPath === undefined) return runMailCli({ argv, cwd: options.cwd, output });

  const path = configPath === undefined ? findDefaultConfig(options.cwd) : resolve(options.cwd, configPath);
  if (path === undefined) {
    output.error(`softure-mail: no config found; looked for ${DEFAULT_CONFIG_FILES.join(", ")} in ${options.cwd}; pass --config <file>`);
    return EXIT_FAILED;
  }
  const config = await loadConfig(path);
  if (typeof config === "string") {
    output.error(`softure-mail: ${config}`);
    return EXIT_FAILED;
  }
  return runMailCli({ config, argv, cwd: options.cwd, output });
}

/** `dns --domain` and help need no config; everything else reads it. */
function needsConfig(argv: readonly string[]): boolean {
  if (argv.length === 0 || argv.includes("--help")) return false;
  return !(argv[0] === "dns" && argv.some((arg) => arg === "--domain" || arg.startsWith("--domain=")));
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
    return `cannot load ${path}: ${reason}. If Node cannot run this file, call runMailCli from an app script (see the @softure-ai/mailing README).`;
  }
  const config = exported.default ?? exported.config;
  return isConfigLike(config) ? config : `${path} must export (default or as "config") the result of defineSoftureConfig`;
}

function isConfigLike(value: unknown): value is SoftureConfig {
  return typeof value === "object" && value !== null && "modules" in value && Array.isArray(value.modules) && "database" in value;
}
