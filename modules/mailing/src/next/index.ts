// The Next.js adapter of @softure-ai/mailing: sending on the registered configuration, the
// unsubscribe page with its action, and the one-click route (docs/02-module-standard.md §8).
export { unsubscribeAction } from "./actions.js";
export { getMailingMessages } from "./messages.js";
export { UnsubscribePage, type UnsubscribePageProps } from "./pages.js";
export { UNSUBSCRIBE_STATUS_PARAM, type UnsubscribeStatus } from "./params.js";
export { getUnsubscribeRoute, postUnsubscribeRoute } from "./route.js";
export { sendMail } from "./send-mail.js";
