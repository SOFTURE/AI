// Server-only API of @softure-ai/waitlist. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; `next/*` imports are not allowed here.
export { checkSignupsTable } from "./health.js";
export { getLocalizedText, getWaitlistMessages, getWaitlistModule, getWaitlistOptions } from "./options.js";
export { deleteWaitlistUserData, exportWaitlistUserData, waitlistPrivacyContributor, type WaitlistUserData } from "./privacy.js";
export {
  CONSENT_SOURCE,
  getSignup,
  joinWaitlist,
  listSignups,
  normalizeEmail,
  type JoinWaitlistInput,
  type JoinWaitlistResult,
  type ListSignupsFilter,
  type WaitlistContext,
} from "./signups.js";
export { UNSUBSCRIBE_CONSENT_SOURCE, withdrawWaitlistConsents } from "./unsubscribe.js";
export { deliverWelcomeMail, getWelcomeMailScope, WAITLIST_MAIL_KIND } from "./welcome-mail.js";
