// Public API of @softure-ai/billing: the module factory for softure.config.ts, its rate limit bucket,
// the manual and Stripe payment adapters, Stripe's webhook signature, the pure entitlement state
// machine and plan periods, prices, types, messages and the tables. Reading and changing
// entitlements, granting plans, starting payments and recording provider payments is in
// `@softure-ai/billing/server`, the Next.js adapter (write guard, payment and admin pages, actions,
// the Stripe webhook route, current badge and notice) in `/next`, the components in `/ui`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { billingMessages } from "./messages/index.js";
import { billingOptionsSchema } from "./options.js";
import { checkBillingTables } from "./server/health.js";
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
 * `billing({ trial: { days: 14 }, plans: [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }], payment: stripe() })`
 * (or `manual({ onRequest })` for invoices).
 */
export const billing = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.0.0",
    dependsOn: { security: "^0.0.0", auth: "^0.0.0" },
    dbSchema: "billing",
    tables: ["entitlements", "payments"],
    env: [
      {
        name: "STRIPE_SECRET_KEY",
        required: false,
        description: "Secret API key of the stripe() payment adapter (sk_test_... in the sandbox), read on every payment; not needed with stripe({ secretKey }) or another adapter.",
      },
      {
        name: "STRIPE_WEBHOOK_SECRET",
        required: false,
        description: "Signing secret (whsec_...) of the Stripe webhook endpoint that points at stripeWebhookRoute; required when that route is mounted.",
      },
    ],
    switches: [],
    routes: { payment: "/payment", webhook: "/api/billing/webhook" },
    mount: [{ kind: "route-handler", path: "app/api/billing/webhook/route.ts", export: "stripeWebhookRoute" }],
    privacy: { exports: true, deletes: true },
  },
  messages: billingMessages,
  options: billingOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: billingPrivacyContributor,
  health: checkBillingTables,
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
export { CHECKOUT_PARAM, CHECKOUT_RESULTS, type CheckoutResult } from "./fields.js";
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
export { billingSchema, entitlements, payments } from "./schema.js";
export { getCheckoutSessionParams, stripe, STRIPE_API_BASE, STRIPE_SECRET_KEY_ENV, STRIPE_TIMEOUT_MS, type StripeOptions } from "./stripe.js";
export {
  parseStripeEvent,
  readStripeWebhook,
  signStripePayload,
  STRIPE_METADATA,
  STRIPE_SIGNATURE_HEADER,
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
  verifyStripeSignature,
  type PaidCheckout,
  type SignStripePayloadInput,
  type StripeWebhookError,
  type StripeWebhookEvent,
  type VerifyStripeSignatureInput,
} from "./stripe-webhook.js";
