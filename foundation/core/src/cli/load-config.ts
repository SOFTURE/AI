// How a module's command-line tool (`softure migrate`, `softure-mail`, `softure-blog`) finds and loads
// the app's `softure.config.*`. The file is loaded with a dynamic import, so it must be one Node can
// run itself: `.js`/`.mjs`, or `.ts` where Node strips types (Node >= 22.18; relative imports then
// need `.ts` extensions). Anything else uses an app script that passes the config to the command.
// Every problem is returned without the tool's name; each tool prefixes its own.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SoftureConfig } from "../config.js";

/** The file names looked up in the working directory when no `--config` is given, in this order. */
export const DEFAULT_CONFIG_FILES: readonly string[] = ["softure.config.ts", "softure.config.mts", "softure.config.js", "softure.config.mjs"];

/** The function and package an app script calls when Node cannot import the config file. */
export interface AppScriptHint {
  /** e.g. `runMigrateCli`. */
  readonly runner: string;
  /** e.g. `@softure-ai/db`, whose README shows the app script. */
  readonly packageName: string;
}

export type ConfigOptionResult =
  | { readonly ok: true; readonly configPath: string | undefined; readonly argv: string[] }
  | { readonly ok: false; readonly problem: string };

export type ConfigLoadResult = { readonly ok: true; readonly config: SoftureConfig } | { readonly ok: false; readonly problem: string };

export interface LoadAppConfigOptions {
  readonly cwd: string;
  /** The `--config` value, relative to `cwd`; `undefined` looks up `DEFAULT_CONFIG_FILES`. */
  readonly configPath: string | undefined;
  readonly appScript: AppScriptHint;
}

/** Takes `--config <file>` or `--config=<file>` out of the arguments and keeps the rest in order. */
export function takeConfigOption(argv: readonly string[]): ConfigOptionResult {
  const rest: string[] = [];
  let configPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--config") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) return { ok: false, problem: "--config needs a file path" };
      configPath = value;
      index += 1;
    } else if (arg.startsWith("--config=")) {
      configPath = arg.slice("--config=".length);
    } else {
      rest.push(arg);
    }
  }
  return { ok: true, configPath, argv: rest };
}

/** The first of `DEFAULT_CONFIG_FILES` that exists in `cwd`, as an absolute path. */
export function findDefaultConfig(cwd: string): string | undefined {
  return DEFAULT_CONFIG_FILES.map((name) => resolve(cwd, name)).find((path) => existsSync(path));
}

/** The config the file exports (default or `config`), or why it could not be used. */
export async function loadConfig(path: string, appScript: AppScriptHint): Promise<ConfigLoadResult> {
  if (!existsSync(path)) return { ok: false, problem: `config file ${path} does not exist` };
  let exported: { default?: unknown; config?: unknown };
  try {
    exported = (await import(pathToFileURL(path).href)) as { default?: unknown; config?: unknown };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      problem: `cannot load ${path}: ${reason}. If Node cannot run this file, call ${appScript.runner} from an app script (see the ${appScript.packageName} README).`,
    };
  }
  const config = exported.default ?? exported.config;
  return isConfigLike(config)
    ? { ok: true, config }
    : { ok: false, problem: `${path} must export (default or as "config") the result of defineSoftureConfig` };
}

/** Loads the `--config` file, or the default one found in `cwd`. */
export async function loadAppConfig(options: LoadAppConfigOptions): Promise<ConfigLoadResult> {
  const path = options.configPath === undefined ? findDefaultConfig(options.cwd) : resolve(options.cwd, options.configPath);
  if (path === undefined) {
    return {
      ok: false,
      problem: `no config found; looked for ${DEFAULT_CONFIG_FILES.join(", ")} in ${options.cwd}; pass --config <file>`,
    };
  }
  return loadConfig(path, options.appScript);
}

function isConfigLike(value: unknown): value is SoftureConfig {
  return typeof value === "object" && value !== null && "modules" in value && Array.isArray(value.modules) && "database" in value;
}
