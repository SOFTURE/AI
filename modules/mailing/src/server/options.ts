// The mailing options and routes of the running app, read from the configuration.
import { getModule, type AnySoftureModule, type SoftureConfig } from "@softure-ai/core";
import type { MailingOptions } from "../options.js";

const MODULE_ID = "mailing";

/** The paths of the unsubscribe page and the one-click route (overridable in `mailing({ routes })`). */
export interface MailingRoutes {
  readonly unsubscribe: string;
  readonly oneClick: string;
}

/** The enabled module. Throws when the app did not enable it: sending then is a bug. */
export function getMailingModule(config: SoftureConfig): AnySoftureModule {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/mailing: the module is not enabled; add mailing({ ... }) to modules in softure.config.ts");
  }
  return module;
}

/** The module's options. Throws when the app did not enable it. */
export function getMailingOptions(config: SoftureConfig): MailingOptions {
  // The module factory parsed these options with mailingOptionsSchema.
  return getMailingModule(config).options as MailingOptions;
}

/** The module's routes, with the app's overrides. Throws when the app did not enable it. */
export function getMailingRoutes(config: SoftureConfig): MailingRoutes {
  // The manifest declares both routes; the factory only replaces their paths.
  return getMailingModule(config).routes as unknown as MailingRoutes;
}

/** The kind an alias of `mailing({ kindAliases })` names, or `kind` itself when it is no alias. */
export function resolveMailKind(config: SoftureConfig, kind: string): string {
  const aliases = getMailingOptions(config).kindAliases ?? {};
  return Object.hasOwn(aliases, kind) ? (aliases[kind] ?? kind) : kind;
}
