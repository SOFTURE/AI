// Public API of @softure-ai/billing: the module factory for softure.config.ts, the pure entitlement
// state machine, types, messages and the entitlements table. Reading and changing entitlements is in
// `@softure-ai/billing/server`, the Next.js adapter (write guard, current badge and notice) in
// `/next`, the components in `/ui`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { billingMessages } from "./messages/index.js";
import { billingOptionsSchema } from "./options.js";
import { checkEntitlementsTable } from "./server/health.js";
import { billingPrivacyContributor } from "./server/privacy.js";

export const MODULE_ID = "billing";

/**
 * Enables entitlements in `softure.config.ts` (after `auth`):
 * `billing({ trial: { days: 14, reminderDays: 3 }, paid: { reminderDays: 7 } })`.
 */
export const billing = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.0.0",
    dependsOn: { auth: "^0.0.0" },
    dbSchema: "billing",
    tables: ["entitlements"],
    env: [],
    switches: [],
    routes: { payment: "/payment" },
    mount: [],
    privacy: { exports: true, deletes: true },
  },
  messages: billingMessages,
  options: billingOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: billingPrivacyContributor,
  health: checkEntitlementsTable,
});

export { getDayNumber, getDaysLeft, getStartOfDay, getTrialEnd } from "./calendar.js";
export {
  ENTITLEMENT_STATUSES,
  type BillingErrorCode,
  type BillingFormErrorCode,
  type Entitlement,
  type EntitlementEvent,
  type EntitlementRecord,
  type EntitlementStatus,
} from "./contract.js";
export { applyEntitlementEvent, hasWriteAccess, resolveEntitlement, type EntitlementPolicy } from "./entitlement.js";
export { billingMessages, getBillingErrorMessage, type BillingMessages } from "./messages/index.js";
export { MAX_DAYS, type BillingOptions, type BillingOptionsInput } from "./options.js";
export { billingSchema, entitlements } from "./schema.js";
