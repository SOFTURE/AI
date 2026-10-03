// Shared test setup: a configuration with the mailing module and a given provider.
import { defineSoftureConfig, type SoftureConfig } from "@softure-ai/core";
import { mailing, type MailingOptionsInput, type MailProvider, type OutgoingMail } from "@softure-ai/mailing";

export const FROM = "Example <hello@mail.example.com>";
export const REPLY_TO = "support@example.com";

export const MAIL: OutgoingMail = {
  to: "ada@example.org",
  subject: "Your weekly summary",
  text: "Hello Ada, here is your summary.",
};

export function createConfig(provider: MailProvider, options: Partial<MailingOptionsInput> = {}): SoftureConfig {
  return defineSoftureConfig({
    locale: "en",
    timezone: "UTC",
    appOrigin: "http://localhost:3000",
    modules: [mailing({ from: FROM, replyTo: REPLY_TO, provider, ...options })],
  });
}
