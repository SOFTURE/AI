// The Next.js adapter of @softure-ai/billing: the signed-in account's entitlement, the write guard
// for server actions, the badge and notice, the pricing tiles, the payment and admin pages and
// their actions, wired to the registered configuration (docs/02-module-standard.md §8).
export { CurrentAccessBadge, type CurrentAccessBadgeProps, CurrentAccessNotice, type CurrentAccessNoticeProps } from "./access.js";
export { grantPlanAction, startPaymentAction } from "./actions.js";
export { getBillingContext } from "./context.js";
export { getCurrentEntitlement, requireWriteAccess, type WriteAccess } from "./current-entitlement.js";
export { BillingAdminPage, PaymentPage, type PaymentPageProps } from "./pages.js";
export { getPlanPaymentHref, Pricing, type PricingProps } from "./pricing.js";
