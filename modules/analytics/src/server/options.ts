// The analytics options of the running app, read from the configuration.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import type { AnalyticsOptions, ChannelOptions } from "../options.js";

const MODULE_ID = "analytics";

/** The parsed options. Throws when the app did not enable the module: calling its functions then is a bug. */
export function getAnalyticsOptions(config: SoftureConfig): AnalyticsOptions {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/analytics: the module is not enabled; add analytics() to modules in softure.config.ts");
  }
  // The module factory parsed these options with analyticsOptionsSchema.
  return module.options as AnalyticsOptions;
}

export function getChannelOptions(config: SoftureConfig): ChannelOptions {
  return getAnalyticsOptions(config).channel;
}
