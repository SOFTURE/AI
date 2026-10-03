import type { SoftureConfig } from "@softure-ai/core";
import type { MailingMessages } from "../messages/index.js";
import { getMailingModule } from "../server/options.js";

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getMailingMessages(config: SoftureConfig): MailingMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getMailingModule(config).messages[config.locale] as MailingMessages;
}
