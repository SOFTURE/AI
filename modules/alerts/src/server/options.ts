// The alerts options and copy of the running app, read from the configuration in the module context.
import { getModule, selectMessages, type ModuleContext, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { MODULE_ID } from "../index.js";
import type { AlertsMessages } from "../messages/index.js";
import type { AlertsOptions } from "../options.js";

/** `{ db, clock, config }`; `db` may be an open transaction, so an alert is recorded with the caller's own write. */
export type AlertsContext = ModuleContext<Queryable>;

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getAlertsModule(config: SoftureConfig) {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/alerts: the module is not enabled; add alerts({ channels: { ... } }) to modules in softure.config.ts");
  }
  return module;
}

export function getAlertsOptions(config: SoftureConfig): AlertsOptions {
  // The module factory parsed these options with alertsOptionsSchema.
  return getAlertsModule(config).options as AlertsOptions;
}

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getAlertsMessages(config: SoftureConfig): AlertsMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return selectMessages(getAlertsModule(config).messages, config.locale) as AlertsMessages;
}

/** The module's routes after the app's overrides (`alerts({ routes: { panel } })`). */
export function getAlertsRoutes(config: SoftureConfig): { readonly panel: string } {
  const { panel } = getAlertsModule(config).routes;
  // The manifest declares the route, so a missing one means a broken module definition.
  if (panel === undefined) throw new Error('@softure-ai/alerts: route "panel" is missing from the module manifest');
  return { panel };
}
