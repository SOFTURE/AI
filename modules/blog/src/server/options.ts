// The blog options of the running app, read from the configuration.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import type { BlogOptions } from "../options.js";
import { resolveQualitySettings, type QualitySettings } from "../quality/settings.js";

const MODULE_ID = "blog";

/** The options of the enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getBlogOptions(config: SoftureConfig): BlogOptions {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/blog: the module is not enabled; add blog() to modules in softure.config.ts");
  }
  // The module factory parsed these options with blogOptionsSchema.
  return module.options as BlogOptions;
}

/** The quality gate's settings, or `null` when the app turned the gate off (`quality: false`). */
export function getQualitySettings(config: SoftureConfig): QualitySettings | null {
  const { quality } = getBlogOptions(config);
  return quality === false ? null : resolveQualitySettings(quality, config);
}
