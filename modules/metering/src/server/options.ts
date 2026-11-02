// The metering options of the running app, read from the configuration in the module context.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import type { MeteringOptions, ProviderDefinition } from "../options.js";

const MODULE_ID = "metering";

/** The parsed options. Throws when the app did not enable the module: calling its functions then is a bug. */
export function getMeteringOptions(config: SoftureConfig): MeteringOptions {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/metering: the module is not enabled; add metering({ ... }) to modules in softure.config.ts");
  }
  // The module factory parsed these options with meteringOptionsSchema.
  return module.options as MeteringOptions;
}

/**
 * The declared provider. Throws for an undeclared id: metering a mistyped provider would spend outside every
 * budget, so it fails loudly.
 */
export function getProviderDefinition(config: SoftureConfig, providerId: string): ProviderDefinition {
  const provider = getMeteringOptions(config).providers.find((definition) => definition.id === providerId);
  if (provider === undefined) {
    throw new Error(`@softure-ai/metering: provider "${providerId}" is not declared; add it to metering({ providers }) in softure.config.ts`);
  }
  return provider;
}
