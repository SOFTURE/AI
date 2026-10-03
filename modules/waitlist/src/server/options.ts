// The waitlist options of the running app, read from the configuration in the module context.
import { getModule, type AnySoftureModule, type Locale, type SoftureConfig } from "@softure-ai/core";
import type { WaitlistMessages } from "../messages/index.js";
import type { WaitlistOptions } from "../options.js";

const MODULE_ID = "waitlist";

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getWaitlistModule(config: SoftureConfig): AnySoftureModule {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/waitlist: the module is not enabled; add waitlist({ ... }) to modules in softure.config.ts");
  }
  return module;
}

export function getWaitlistOptions(config: SoftureConfig): WaitlistOptions {
  // The module factory parsed these options with waitlistOptionsSchema.
  return getWaitlistModule(config).options as WaitlistOptions;
}

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getWaitlistMessages(config: SoftureConfig): WaitlistMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getWaitlistModule(config).messages[config.locale] as WaitlistMessages;
}

/** A label from the config in `locale`, falling back to `en` (which the options require). */
export function getLocalizedText(text: Partial<Record<Locale, string>>, locale: Locale): string {
  return text[locale] ?? text.en ?? "";
}
