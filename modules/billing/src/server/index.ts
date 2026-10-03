// Server-only API of @softure-ai/billing. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; `next/*` imports are not allowed here.
export {
  changeEntitlement,
  checkWriteAccess,
  findEntitlementRecord,
  getDefaultRecord,
  getEntitlement,
  type BillingContext,
  type EntitlementEventResolver,
} from "./entitlements.js";
export { checkBillingTables } from "./health.js";
export {
  receiveStripeWebhook,
  recordPayment,
  refundPayment,
  STRIPE_PROVIDER,
  type PaymentOutcome,
  type ReceiveStripeWebhookInput,
  type RecordPaymentError,
  type RecordPaymentInput,
  type RefundPaymentInput,
  type StripeWebhookReceipt,
} from "./payments.js";
export {
  getBillingMessages,
  getBillingModule,
  getBillingOptions,
  getBillingRoutes,
  getEntitlementPolicy,
  type BillingRoutes,
} from "./options.js";
export {
  findAccountByEmail,
  getBillingPlans,
  getPaymentProvider,
  grantPlan,
  parseInvoiceDetails,
  startPayment,
  type InvoiceDetailsError,
  type InvoiceInput,
  type StartPaymentInput,
  type StartPaymentResult,
} from "./plans.js";
export { billingPrivacyContributor, deleteBillingUserData, exportBillingUserData, type BillingPaymentData, type BillingUserData } from "./privacy.js";
export { assertPaymentSetup, PAYMENT_BUCKET } from "./setup.js";
