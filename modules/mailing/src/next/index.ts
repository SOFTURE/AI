// The Next.js adapter of @softure-ai/mailing: sending (and sending once, through the ledger) on the
// registered configuration, the unsubscribe page with its action, and the one-click route
// (docs/02-module-standard.md §8).
export { unsubscribeAction } from "./actions.js";
export { deliverOnce } from "./deliver-once.js";
export { importDeliveries } from "./import-deliveries.js";
export { getMailingMessages } from "./messages.js";
export { createUnsubscribePage, UnsubscribePage, type UnsubscribeLayoutProps, type UnsubscribePageOptions, type UnsubscribePageProps, type UnsubscribePageSlot } from "./pages.js";
export { previewMail } from "./preview-mail.js";
export { UNSUBSCRIBE_STATUS_PARAM, type UnsubscribeStatus } from "./params.js";
export { getUnsubscribeRoute, postUnsubscribeRoute } from "./route.js";
export { runDeliveries } from "./run-deliveries.js";
export { sendMail } from "./send-mail.js";
