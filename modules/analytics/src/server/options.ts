// The analytics options of the running app, read from the configuration.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import type { AnalyticsOptions, ChannelOptions } from "../options.js";

const MODULE_ID = "analytics";

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
function getAnalyticsModule(config: SoftureConfig) {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/analytics: the module is not enabled; add analytics() to modules in softure.config.ts");
  }
  return module;
}

/** The parsed options. Throws when the app did not enable the module. */
export function getAnalyticsOptions(config: SoftureConfig): AnalyticsOptions {
  // The module factory parsed these options with analyticsOptionsSchema.
  return getAnalyticsModule(config).options as AnalyticsOptions;
}

export function getChannelOptions(config: SoftureConfig): ChannelOptions {
  return getAnalyticsOptions(config).channel;
}

/** The path of the funnel endpoint (`routes.funnel`, `/api/analytics/funnel` by default). */
export function getFunnelEndpoint(config: SoftureConfig): string {
  const path = getAnalyticsModule(config).routes.funnel;
  // The manifest declares the route, so a missing one means a broken module definition.
  if (path === undefined) throw new Error('@softure-ai/analytics: route "funnel" is missing from the module manifest');
  return path;
}
