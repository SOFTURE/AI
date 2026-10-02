import type { SoftureConfig } from "@softure-ai/core";
import type { FeatureSwitchesMessages } from "../messages/index.js";
import { getFeatureSwitchesModule } from "../server/options.js";

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getFeatureSwitchesMessages(config: SoftureConfig): FeatureSwitchesMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getFeatureSwitchesModule(config).messages[config.locale] as FeatureSwitchesMessages;
}
