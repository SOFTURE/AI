// Public API of @softure-ai/mailing: the module factory for softure.config.ts, the provider
// contract, the Resend adapter, types and messages. Sending is in `@softure-ai/mailing/server`
// (and `/next` on the registered config); the fake provider for tests is in `/testing`.
import { defineModule } from "@softure-ai/core";
import { mailingMessages } from "./messages/index.js";
import { mailingOptionsSchema } from "./options.js";

export const MODULE_ID = "mailing";

/**
 * Enables mail in `softure.config.ts`:
 * `mailing({ from: "Plan <hello@mail.example.com>", replyTo: "support@example.com", provider: resend() })`.
 */
export const mailing = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.0.0",
    dependsOn: {},
    dbSchema: null,
    tables: [],
    env: [
      {
        name: "RESEND_API_KEY",
        required: false,
        description: "API key of the resend() provider, read on every send; not needed with resend({ apiKey }) or another provider.",
      },
    ],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  },
  messages: mailingMessages,
  options: mailingOptionsSchema,
});

export { isMailbox, isSingleAddress, MAX_ADDRESS_LENGTH, MAX_IDEMPOTENCY_KEY_LENGTH, MAX_SUBJECT_LENGTH, RESERVED_HEADERS } from "./address.js";
export type {
  MailingErrorCode,
  MailProvider,
  OutgoingMail,
  ProviderMessage,
  ProviderOutcome,
  SendMailOptions,
  SendMailResult,
  SentMail,
} from "./contract.js";
export { getMailingErrorMessage, mailingMessages, type MailingMessages } from "./messages/index.js";
export { DEFAULT_TIMEOUT_MS, type MailingOptions, type MailingOptionsInput } from "./options.js";
export { resend, RESEND_API_KEY_ENV, RESEND_ENDPOINT, type ResendOptions } from "./providers/resend.js";
