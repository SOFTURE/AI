import { selectMessages, type SoftureConfig } from "@softure-ai/core";
import type { ConnectionsMessages } from "../messages/index.js";
import { getConnectionsModule } from "../server/options.js";

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getConnectionsMessages(config: SoftureConfig): ConnectionsMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return selectMessages(getConnectionsModule(config).messages, config.locale) as ConnectionsMessages;
}
