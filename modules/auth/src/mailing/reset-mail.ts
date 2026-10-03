// The password reset mail: rendered from auth's dictionaries in the app's locale and sent through
// `@softure-ai/mailing`. A transactional mail: no unsubscribe link, never suppressed. The link is
// placed by the code, never by a translatable string, so a copy override cannot drop it.
import { formatMessage, selectPlural, type Locale, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import type { OutgoingMail } from "@softure-ai/mailing";
import { sendMail } from "@softure-ai/mailing/server";
import type { AuthMessages } from "../messages/index.js";
import type { PasswordResetSender } from "../password-reset-sender.js";
import { getAuthModule, getAuthOptions } from "../server/options.js";

export interface PasswordResetMailInput {
  /** The reset link auth hands to the sender. */
  readonly link: string;
  /** How long the link works (`passwordReset.ttlMinutes`). */
  readonly ttlMinutes: number;
}

/** The subject and bodies of a reset mail, without the recipient. */
export type PasswordResetMail = Pick<OutgoingMail, "subject" | "text"> & { readonly html: string };

const HTML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/**
 * Renders the reset mail from `messages` (one locale's dictionary, overrides applied): a plain-text
 * body with the bare link and an HTML body with the same paragraphs and the link as an anchor.
 */
export function renderPasswordResetMail(messages: AuthMessages, locale: Locale, input: PasswordResetMailInput): PasswordResetMail {
  const copy = messages.resetMail;
  const duration = formatMessage(selectPlural(locale, input.ttlMinutes, copy.minutes), { count: input.ttlMinutes });
  const expiry = formatMessage(copy.expiry, { duration });

  const text = [copy.greeting, copy.intro, input.link, expiry, copy.ignore].join("\n\n");
  const paragraphs = [
    escapeHtml(copy.greeting),
    escapeHtml(copy.intro),
    `<a href="${escapeHtml(input.link)}">${escapeHtml(copy.action)}</a>`,
    escapeHtml(expiry),
    escapeHtml(copy.ignore),
  ];
  const html = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("\n");
  return { subject: copy.subject, text, html };
}

/** The app's auth dictionary for `locale`, with its overrides applied. */
function getMessages(config: SoftureConfig, locale: Locale): AuthMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getAuthModule(config).messages[locale] as AuthMessages;
}

/**
 * A `passwordReset.send` that mails the link through `@softure-ai/mailing`:
 * `auth({ passwordReset: { send: mailingResetSender() } })` next to `mailing({ ... })`. It reads the
 * registered config (`registerSoftureConfig`) when it runs. A failed send throws an error naming
 * the `mailing.*` code (never the address or the link), which auth logs.
 */
export function mailingResetSender(): PasswordResetSender {
  return async (link, user, details) => {
    const config = getSoftureConfig();
    const mail = renderPasswordResetMail(getMessages(config, details.locale), details.locale, {
      link,
      ttlMinutes: getAuthOptions(config).passwordReset.ttlMinutes,
    });
    const result = await sendMail({ config }, { to: user.email, ...mail });
    if (!result.ok) {
      throw new Error(`@softure-ai/auth: the password reset mail was not sent (${result.error})`);
    }
  };
}
