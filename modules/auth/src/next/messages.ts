import type { SoftureConfig } from "@softure-ai/core";
import type { AuthMessages } from "../messages/index.js";
import { getAuthModule } from "../server/options.js";

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getAuthMessages(config: SoftureConfig): AuthMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getAuthModule(config).messages[config.locale] as AuthMessages;
}
