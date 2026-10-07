// Public API of @softure-ai/mailing: the module factory for softure.config.ts, the provider
// contract, the Resend adapter, types, messages and the tables. Sending, the suppression list, the
// delivery ledger and campaigns are in `@softure-ai/mailing/server` (and `/next` on the registered
// config, with the unsubscribe page and one-click route); the `softure-mail` command is in `/cli`;
// the fake provider for tests is in `/testing`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { mailingMessages } from "./messages/index.js";
import { mailingOptionsSchema } from "./options.js";
import { checkMailingTables } from "./server/health.js";

export const MODULE_ID = "mailing";

/**
 * Enables mail in `softure.config.ts`:
 * `mailing({ from: "Plan <hello@mail.example.com>", replyTo: "support@example.com", provider: resend() })`.
 */
export const mailing = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.6",
    dependsOn: {},
    dbSchema: "mailing",
    tables: ["suppressions", "campaigns", "deliveries"],
    env: [
      {
        name: "RESEND_API_KEY",
        required: false,
        description: "API key of the resend() provider, read on every send; not needed with resend({ apiKey }) or another provider.",
      },
      {
        name: "MAILING_UNSUBSCRIBE_SECRET",
        required: false,
        description: "Signs and verifies unsubscribe links, at least 32 characters; required to send list mail (any kind but transactional). Never change it without moving the old value to MAILING_UNSUBSCRIBE_SECRET_PREVIOUS.",
      },
      {
        name: "MAILING_UNSUBSCRIBE_SECRET_PREVIOUS",
        required: false,
        description: "The secret before a rotation, at least 32 characters: verifies links in mail already sent, never signs.",
      },
    ],
    switches: [],
    routes: { unsubscribe: "/unsubscribe", oneClick: "/api/mailing/unsubscribe" },
    mount: [
      { kind: "page", path: "app/unsubscribe/page.tsx", export: "UnsubscribePage" },
      { kind: "route-handler", path: "app/api/mailing/unsubscribe/route.ts", export: "postUnsubscribeRoute" },
      { kind: "route-handler", path: "app/api/mailing/unsubscribe/route.ts", export: "getUnsubscribeRoute" },
    ],
    privacy: { exports: false, deletes: false },
  },
  messages: mailingMessages,
  options: mailingOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  health: checkMailingTables,
});

export {
  isMailbox,
  isMailKind,
  isSingleAddress,
  LIST_MAIL_HEADERS,
  MAX_ADDRESS_LENGTH,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_MAIL_KIND_LENGTH,
  MAX_SUBJECT_LENGTH,
  RESERVED_HEADERS,
} from "./address.js";
export { HALTING_ERROR_CODES, TRANSACTIONAL_KIND } from "./contract.js";
export type {
  CampaignRecipient,
  CampaignRecipientFilter,
  LegacyUnsubscribe,
  MailingErrorCode,
  MailProvider,
  OnUnsubscribedHook,
  OutgoingMail,
  ProviderFailureStatus,
  ProviderMessage,
  ProviderOutcome,
  SendMailFailure,
  SendMailOptions,
  SendMailResult,
  SentMail,
  SuppressionSource,
  UnsubscribeErrorCode,
  UnsubscribeEvent,
} from "./contract.js";
export { getMailingErrorMessage, mailingMessages, type MailingMessages } from "./messages/index.js";
export { DEFAULT_STALE_CLAIM_MS, DEFAULT_TIMEOUT_MS, DEFAULT_UNCERTAIN_CLAIM_MS, type MailingOptions, type MailingOptionsInput } from "./options.js";
export { resend, RESEND_API_KEY_ENV, RESEND_ENDPOINT, type ResendOptions } from "./providers/resend.js";
export { campaigns, deliveries, mailingSchema, suppressions, type DeliveryStatus } from "./schema.js";
