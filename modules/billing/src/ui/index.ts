// The billing components, to compose into the app's own pages. They render from props (an
// entitlement read on the server) and import nothing from `next/*` (docs/02-module-standard.md §5);
// `/next` renders them for the signed-in account.
export { AccessBadge, type AccessBadgeProps, type AccessBadgeSlot } from "./access-badge.js";
export { AccessNotice, type AccessNoticeProps, type AccessNoticeSlot } from "./access-notice.js";
export { formatDaysLeft, formatLastDay } from "./format.js";
