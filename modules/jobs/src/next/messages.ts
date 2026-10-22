import { selectMessages, type SoftureConfig } from "@softure-ai/core";
import type { JobsMessages } from "../messages/index.js";
import { getJobsModule } from "../server/options.js";

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getJobsMessages(config: SoftureConfig): JobsMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return selectMessages(getJobsModule(config).messages, config.locale) as JobsMessages;
}
