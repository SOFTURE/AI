// Server-only API of @softure-ai/billing. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; `next/*` imports are not allowed here.
export {
  changeEntitlement,
  checkWriteAccess,
  findEntitlementRecord,
  getDefaultRecord,
  getEntitlement,
  importEntitlement,
  pinDerivedTrials,
  type BillingContext,
  type EntitlementEventResolver,
  type ImportEntitlementInput,
} from "./entitlements.js";
export {
  ACCOUNT_HISTORY_LIMIT,
  getAccountHistory,
  grantPaymentRequest,
  grantPlanManually,
  revokeManualGrant,
  type AccountHistoryEntry,
  type GrantPaymentRequestInput,
  type GrantPlanManuallyError,
  type GrantPlanManuallyInput,
  type ManualGrantResult,
  type RevokeManualGrantInput,
} from "./grants.js";
export { checkBillingTables } from "./health.js";
export { findAccessReminders, type AccessReminderDue, type FindAccessRemindersOptions } from "./reminders.js";
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
  findAccountById,
  getBillingPlans,
  getPaymentProvider,
  grantPlan,
  startPayment,
  type StartPaymentInput,
  type StartPaymentResult,
} from "./plans.js";
export { parseInvoiceDetails, type InvoiceDetailsError, type InvoiceInput } from "../invoice.js";
export {
  billingPrivacyContributor,
  deleteBillingUserData,
  exportBillingUserData,
  type BillingManualGrantData,
  type BillingPaymentData,
  type BillingPaymentRequestData,
  type BillingUserData,
} from "./privacy.js";
export {
  dismissPaymentRequest,
  listOpenRequests,
  OPEN_REQUESTS_LIMIT,
  recordPaymentRequest,
  type OpenPaymentRequest,
  type RecordPaymentRequestInput,
} from "./requests.js";
export { assertAdminRoleDeclared, assertPaymentSetup, PAYMENT_BUCKET } from "./setup.js";
