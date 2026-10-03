// The Next.js adapter of @softure-ai/waitlist: the join and confirm actions, the form wired to the
// registered configuration and the confirmation page (docs/02-module-standard.md §8).
export { confirmSignupAction, joinWaitlistAction } from "./actions.js";
export { ConfirmSignupPage, type ConfirmSignupPageProps } from "./confirm-page.js";
export { getWaitlistContext } from "./context.js";
export { CONFIRM_STATUS_PARAM, type ConfirmStatus } from "./params.js";
export { Waitlist, type WaitlistProps } from "./waitlist.js";
