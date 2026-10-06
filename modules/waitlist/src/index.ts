// Public API of @softure-ai/waitlist: the module factory for softure.config.ts, its rate limit
// buckets, types, messages and the sign-ups table. Joining, confirming, the mails and reading
// sign-ups are in `@softure-ai/waitlist/server`, the Next.js adapter (actions, `Waitlist` component,
// confirmation page) in `/next`, the form in `/ui`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { waitlistMessages } from "./messages/index.js";
import { waitlistOptionsSchema } from "./options.js";
import { checkSignupsTable } from "./server/health.js";
import { waitlistPrivacyContributor } from "./server/privacy.js";

export const MODULE_ID = "waitlist";

/**
 * Rate limit buckets the waitlist consumes, with defaults to spread into `security({ buckets })`:
 * `waitlist` per client address and `waitlist-email` per signed-up address (a form sent for
 * someone else's address many times).
 */
export const WAITLIST_RATE_LIMIT_BUCKETS = {
  waitlist: { limit: 10, windowMinutes: 15 },
  "waitlist-email": { limit: 3, windowMinutes: 60 },
} as const;

/**
 * Enables the waitlist in `softure.config.ts` (after `security`, `mailing` and `privacy`):
 * `waitlist({ scopes: [{ id: "launch", required: true, document: "privacy-policy", label: { en: "Tell me when it opens." } }], placements: ["hero", "footer"] })`.
 */
export const waitlist = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.5",
    dependsOn: { security: "^0.1.0", mailing: "^0.1.0", privacy: "^0.1.0" },
    dbSchema: "waitlist",
    tables: ["signups"],
    env: [],
    switches: [],
    routes: { confirm: "/waitlist/confirm" },
    mount: [{ kind: "page", path: "app/waitlist/confirm/page.tsx", export: "ConfirmSignupPage" }],
    privacy: { exports: true, deletes: true },
  },
  messages: waitlistMessages,
  options: waitlistOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: waitlistPrivacyContributor,
  health: checkSignupsTable,
});

export {
  INITIAL_WAITLIST_FORM_STATE,
  type WaitlistConfirmationErrorCode,
  type WaitlistErrorCode,
  type WaitlistFormErrorCode,
  type WaitlistFormField,
  type WaitlistFormState,
  type WaitlistJoinedEvent,
  type WaitlistSignup,
} from "./contract.js";
export { EMAIL_FIELD, getScopeFieldName, PLACEMENT_FIELD } from "./fields.js";
export {
  escapeHtml,
  type ConfirmationMailTemplateInput,
  type WaitlistMailTemplate,
  type WaitlistMailTemplateInput,
  type WelcomeMailTemplateInput,
} from "./mail-template.js";
export { getWaitlistErrorMessage, waitlistMessages, type WaitlistMessages } from "./messages/index.js";
export {
  DEFAULT_CONFIRMATION_HOURS,
  MAX_CONFIRMATION_HOURS,
  MAX_NAME_LENGTH,
  MAX_SCOPES,
  NAME_PATTERN,
  type OnJoinedHook,
  type RewriteConfirmationLink,
  type WaitlistOptions,
  type WaitlistOptionsInput,
  type WaitlistScope,
  type WaitlistScopeInput,
} from "./options.js";
export { signups, waitlistSchema } from "./schema.js";
