// Server-only API of @softure-ai/waitlist. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; `next/*` imports are not allowed here.
export { CONFIRMATION_TOKEN_PARAM, deliverConfirmationMail, getConfirmationLink, resolveConfirmationLink } from "./confirmation-mail.js";
export { checkSignupsTable } from "./health.js";
export {
  IMPORT_CONSENT_SOURCE,
  importSignups,
  MAX_IMPORT_ROWS,
  type ImportSignupRow,
  type ImportSignupsOptions,
  type ImportSignupsRefusal,
  type ImportSignupsResult,
  type ImportSignupsSummary,
} from "./import.js";
export {
  getLocalizedText,
  getWaitlistMessages,
  getWaitlistMessagesIn,
  getWaitlistModule,
  getWaitlistOptions,
  getWaitlistRoutes,
  type WaitlistRoutes,
} from "./options.js";
export { deleteWaitlistUserData, exportWaitlistUserData, waitlistPrivacyContributor, type WaitlistUserData } from "./privacy.js";
export {
  confirmSignup,
  CONSENT_SOURCE,
  countSignupsByChannel,
  getSignup,
  getSignupById,
  isChannel,
  joinWaitlist,
  listSignups,
  normalizeEmail,
  pruneUnconfirmedSignups,
  type ChannelCount,
  type CountSignupsByChannelOptions,
  type ConfirmSignupInput,
  type ConfirmSignupResult,
  type JoinedSignup,
  type JoinWaitlistInput,
  type JoinWaitlistResult,
  type ListSignupsFilter,
  type PendingSignup,
  type SuppressedSignup,
  type SuppressedSplitChannelCount,
  type WaitlistContext,
} from "./signups.js";
export { UNSUBSCRIBE_CONSENT_SOURCE, withdrawWaitlistConsents } from "./unsubscribe.js";
export { deliverWelcomeMail, getWelcomeMailScope, WAITLIST_MAIL_KIND } from "./welcome-mail.js";
