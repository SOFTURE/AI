// The `softure` bin: `softure migrate [--config <file>] [options]`. It loads the app's config with
// a dynamic import, so the file must be loadable by Node itself: `.js`/`.mjs`, or `.ts` where
// Node strips types (Node >= 22.18; relative imports then need `.ts` extensions). Anything else
// uses an app script with `runMigrateCli` instead (see run.ts).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SoftureConfig } from "@softure-ai/core";
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, MIGRATE_USAGE, runMigrateCli, type CliOutput } from "./run.js";

export interface RunSoftureCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output?: CliOutput;
}

const DEFAULT_CONFIG_FILES = ["softure.config.ts", "softure.config.mts", "softure.config.js", "softure.config.mjs"];

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
  if (typeof taken === "string") {
    output.error(`softure migrate: ${taken}`);
    output.error(MIGRATE_USAGE);
    return EXIT_USAGE;
  }
  const { configPath, argv } = taken;
  const path = configPath === undefined ? findDefaultConfig(options.cwd) : resolve(options.cwd, configPath);
  if (path === undefined) {
    output.error(`softure: no config found; looked for ${DEFAULT_CONFIG_FILES.join(", ")} in ${options.cwd}; pass --config <file>`);
    return EXIT_FAILED;
  }
  const config = await loadConfig(path);
  if (typeof config === "string") {
    output.error(`softure: ${config}`);
    return EXIT_FAILED;
  }
  return runMigrateCli({ config, argv, cwd: options.cwd, output });
}

function takeConfigOption(argv: readonly string[]): { configPath: string | undefined; argv: string[] } | string {
  const rest: string[] = [];
  let configPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--config") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return "--config needs a file path";
      }
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
async function loadConfig(path: string): Promise<Pick<SoftureConfig, "database" | "modules"> | string> {
  if (!existsSync(path)) {
    return `config file ${path} does not exist`;
  }
  let exported: { default?: unknown; config?: unknown };
  try {
    exported = (await import(pathToFileURL(path).href)) as { default?: unknown; config?: unknown };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `cannot load ${path}: ${reason}. If Node cannot run this file, call runMigrateCli from an app script (see the @softure-ai/db README).`;
  }
  const config = exported.default ?? exported.config;
  return isConfigLike(config) ? config : `${path} must export (default or as "config") the result of defineSoftureConfig`;
}

function isConfigLike(value: unknown): value is Pick<SoftureConfig, "database" | "modules"> {
  return typeof value === "object" && value !== null && "modules" in value && Array.isArray(value.modules);
}
