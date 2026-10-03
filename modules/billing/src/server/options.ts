// The billing options of the running app, read from the configuration in the module context.
import { getModule, type AnySoftureModule, type SoftureConfig } from "@softure-ai/core";
import type { EntitlementPolicy } from "../entitlement.js";
import type { BillingMessages } from "../messages/index.js";
import type { BillingOptions } from "../options.js";

const MODULE_ID = "billing";

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getBillingModule(config: SoftureConfig): AnySoftureModule {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/billing: the module is not enabled; add billing({ ... }) to modules in softure.config.ts");
  }
  return module;
}

export function getBillingOptions(config: SoftureConfig): BillingOptions {
  // The module factory parsed these options with billingOptionsSchema.
  return getBillingModule(config).options as BillingOptions;
}

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getBillingMessages(config: SoftureConfig): BillingMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getBillingModule(config).messages[config.locale] as BillingMessages;
}

export interface BillingRoutes {
  /** The payment page (`PaymentPage`), where the notices and the pricing tiles send an account to pay. */
  readonly payment: string;
}

/** The module's routes with the app's overrides applied. */
export function getBillingRoutes(config: SoftureConfig): BillingRoutes {
  const payment = getBillingModule(config).routes.payment;
  // The manifest declares the route, so a missing one means a broken module definition.
  if (payment === undefined) throw new Error('@softure-ai/billing: route "payment" is missing from the module manifest');
  return { payment };
}

/** The state machine's policy from the options and the app's time zone. */
export function getEntitlementPolicy(config: SoftureConfig): EntitlementPolicy {
  const options = getBillingOptions(config);
  return { timezone: config.timezone, trialReminderDays: options.trial.reminderDays, paidReminderDays: options.paid.reminderDays };
}
