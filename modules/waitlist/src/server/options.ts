// The waitlist options of the running app, read from the configuration in the module context.
import { getModule, isLocale, type AnySoftureModule, type Locale, type SoftureConfig } from "@softure-ai/core";
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

/** The module's copy in a stored locale (a sign-up's), falling back to the app's locale. */
export function getWaitlistMessagesIn(config: SoftureConfig, locale: string): WaitlistMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getWaitlistModule(config).messages[isLocale(locale) ? locale : config.locale] as WaitlistMessages;
}

/** The path of the confirmation page (overridable in `waitlist({ routes })`). */
export interface WaitlistRoutes {
  readonly confirm: string;
}

/** The module's routes, with the app's overrides. */
export function getWaitlistRoutes(config: SoftureConfig): WaitlistRoutes {
  // The manifest declares the route; the factory only replaces its path.
  return getWaitlistModule(config).routes as unknown as WaitlistRoutes;
}

/** A label from the config in `locale`, falling back to `en` (which the options require). */
export function getLocalizedText(text: Partial<Record<Locale, string>>, locale: Locale): string {
  return text[locale] ?? text.en ?? "";
}
