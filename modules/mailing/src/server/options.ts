// The mailing options of the running app, read from the configuration.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import type { MailingOptions } from "../options.js";

const MODULE_ID = "mailing";

/** The module's options. Throws when the app did not enable it: sending then is a bug. */
export function getMailingOptions(config: SoftureConfig): MailingOptions {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/mailing: the module is not enabled; add mailing({ ... }) to modules in softure.config.ts");
  }
  // The module factory parsed these options with mailingOptionsSchema.
  return module.options as MailingOptions;
}
