// The privacy options and routes of the running app, read from the configuration in the module context.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import type { PrivacyOptions } from "../options.js";

const MODULE_ID = "privacy";

export interface PrivacyRoutes {
  /** The page with the export link and the delete form. */
  readonly account: string;
  /** The export route handler. */
  readonly export: string;
  /** Where a deleted account lands, signed out. */
  readonly afterDelete: string;
}

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getPrivacyModule(config: SoftureConfig) {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/privacy: the module is not enabled; add privacy({ ... }) to modules in softure.config.ts");
  }
  return module;
}

export function getPrivacyOptions(config: SoftureConfig): PrivacyOptions {
  // The module factory parsed these options with privacyOptionsSchema.
  return getPrivacyModule(config).options as PrivacyOptions;
}

export function getPrivacyRoutes(config: SoftureConfig): PrivacyRoutes {
  // The manifest declares exactly these routes; the factory merged the app's overrides.
  return getPrivacyModule(config).routes as unknown as PrivacyRoutes;
}
