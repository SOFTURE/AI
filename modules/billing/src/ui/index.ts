// The billing components, to compose into the app's own pages. They render from props (an
// entitlement or the plans read on the server) and import nothing from `next/*`
// (docs/02-module-standard.md §5); `/next` renders them wired to the registered configuration.
export { AccessBadge, type AccessBadgeProps, type AccessBadgeSlot } from "./access-badge.js";
export { AccessNotice, type AccessNoticeProps, type AccessNoticeSlot } from "./access-notice.js";
export { formatDay, formatDaysLeft, formatLastDay, formatPeriod } from "./format.js";
export { GrantForm, type GrantFormAction, type GrantFormProps, type GrantFormSlot } from "./grant-form.js";
export {
  AccountLookup,
  type AccountLookupProps,
  type AccountLookupSlot,
  GrantHistory,
  type GrantHistoryProps,
  type GrantHistoryRow,
  type GrantHistorySlot,
} from "./grant-history.js";
export { PaymentForm, type PaymentFormAction, type PaymentFormProps, type PaymentFormSlot } from "./payment-form.js";
export {
  type AdminAction,
  PaymentRequestList,
  type PaymentRequestListProps,
  type PaymentRequestListSlot,
  type PaymentRequestRow,
} from "./payment-requests.js";
export { PricingTiles, type PricingTilesProps, type PricingTilesSlot } from "./pricing-tiles.js";
export { TrialForm, type TrialFormAction, type TrialFormProps, type TrialFormSlot } from "./trial-form.js";
