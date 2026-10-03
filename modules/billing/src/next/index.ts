// The Next.js adapter of @softure-ai/billing: the signed-in account's entitlement, the write guard
// for server actions, and the badge and notice wired to the registered configuration
// (docs/02-module-standard.md §8).
export { CurrentAccessBadge, type CurrentAccessBadgeProps, CurrentAccessNotice, type CurrentAccessNoticeProps } from "./access.js";
export { getBillingContext } from "./context.js";
export { getCurrentEntitlement, requireWriteAccess, type WriteAccess } from "./current-entitlement.js";
