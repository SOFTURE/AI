// `@softure-ai/core/cli`: the config loading shared by the modules' command-line tools. Node only;
// the root entry stays free of `node:` imports.
export {
  DEFAULT_CONFIG_FILES,
  findDefaultConfig,
  loadAppConfig,
  loadConfig,
  takeConfigOption,
  type AppScriptHint,
  type ConfigLoadResult,
  type ConfigOptionResult,
  type DatabaseRequirement,
  type LoadAppConfigOptions,
  type LoadConfigOptions,
} from "./load-config.js";
