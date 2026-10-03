// Public API of @softure-ai/billing: the module factory for softure.config.ts, its rate limit bucket,
// the manual payment adapter, the pure entitlement state machine and plan periods, prices, types,
// messages and the entitlements table. Reading and changing entitlements, granting plans and
// starting payments is in `@softure-ai/billing/server`, the Next.js adapter (write guard, payment
// and admin pages, actions, current badge and notice) in `/next`, the components in `/ui`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { billingMessages } from "./messages/index.js";
import { billingOptionsSchema } from "./options.js";
import { checkEntitlementsTable } from "./server/health.js";
import { billingPrivacyContributor } from "./server/privacy.js";

export const MODULE_ID = "billing";

/**
 * The rate limit bucket payments consume, with its default to spread into `security({ buckets })`:
 * `billing-payment` per account (a payment page sent again and again).
 */
export const BILLING_RATE_LIMIT_BUCKETS = {
  "billing-payment": { limit: 5, windowMinutes: 60 },
} as const;

/**
 * Enables entitlements, plans and payments in `softure.config.ts` (after `security` and `auth`):
 * `billing({ trial: { days: 14 }, plans: [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }], payment: manual({ onRequest }) })`.
 */
export const billing = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.0.0",
    dependsOn: { security: "^0.0.0", auth: "^0.0.0" },
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
  INITIAL_GRANT_FORM_STATE,
  INITIAL_PAYMENT_FORM_STATE,
  PERIOD_UNITS,
  type BillingErrorCode,
  type BillingFormErrorCode,
  type Entitlement,
  type EntitlementEvent,
  type EntitlementRecord,
  type EntitlementStatus,
  type GrantFormErrorCode,
  type GrantFormState,
  type LocalizedText,
  type PaymentErrorCode,
  type PaymentFormErrorCode,
  type PaymentFormState,
  type PeriodUnit,
  type Plan,
  type PlanPeriod,
  type PlanPrice,
} from "./contract.js";
export { applyEntitlementEvent, hasWriteAccess, resolveEntitlement, type EntitlementPolicy } from "./entitlement.js";
export { manual, type ManualPaymentOptions } from "./manual.js";
export { billingMessages, getBillingErrorMessage, type BillingMessages } from "./messages/index.js";
export {
  MAX_DAYS,
  MAX_FEATURES,
  MAX_PERIOD_COUNT,
  MAX_PLANS,
  MAX_PRICE_AMOUNT,
  type BillingOptions,
  type BillingOptionsInput,
} from "./options.js";
export {
  isPaymentProvider,
  type InvoiceDetails,
  type PaymentAccount,
  type PaymentContext,
  type PaymentProvider,
  type PaymentRequest,
  type PaymentStart,
} from "./payment.js";
export { findPlan, getLocalizedText, getPeriodEnd, getPlanGrant } from "./plans.js";
export { formatPrice, getMinorUnitDigits, isSupportedCurrency } from "./price.js";
export { billingSchema, entitlements } from "./schema.js";
