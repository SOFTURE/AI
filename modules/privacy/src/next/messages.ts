import type { SoftureConfig } from "@softure-ai/core";
import type { PrivacyMessages } from "../messages/index.js";
import { getPrivacyModule } from "../server/options.js";

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getPrivacyMessages(config: SoftureConfig): PrivacyMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getPrivacyModule(config).messages[config.locale] as PrivacyMessages;
}
