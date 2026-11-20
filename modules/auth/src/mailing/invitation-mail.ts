// The invitation mail: rendered from auth's dictionaries in the app's locale and sent through `@softure-ai/mailing`.
// A transactional mail: no unsubscribe link, never suppressed. The link is placed by the code, never by a translatable
// string, so a copy override cannot drop it.
import { formatMessage, type Locale, selectPlural } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { sendMail } from "@softure-ai/mailing/server";
import type { InvitationSender } from "../invitation-sender.js";
import { getInvitationMailMessages, type AuthMessages } from "../messages/index.js";
import { getAuthOptions } from "../server/options.js";
import { escapeHtml, getMailMessages, type PasswordResetMail } from "./reset-mail.js";

export interface InvitationMailInput {
  /** The invitation link auth hands to the sender. */
  readonly link: string;
  /** How long the link works (`invitations.ttlHours`). */
  readonly ttlHours: number;
}

/** The subject and bodies of an invitation mail, without the recipient. */
export type InvitationMail = PasswordResetMail;

/**
 * Renders the invitation mail from `messages` (one locale's dictionary, overrides applied): a plain-text body with the
 * bare link and an HTML body with the same paragraphs and the link as an anchor.
 */
export function renderInvitationMail(messages: AuthMessages, locale: Locale, input: InvitationMailInput): InvitationMail {
  const copy = getInvitationMailMessages(messages);
  const duration = formatMessage(selectPlural(locale, input.ttlHours, copy.hours), { count: input.ttlHours });
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

/**
 * An `invitations.send` that mails the link through `@softure-ai/mailing`:
 * `auth({ invitations: { send: mailingInvitationSender() } })` next to `mailing({ ... })`. It reads the registered
 * config (`registerSoftureConfig`) when it runs. A failed send throws an error naming the `mailing.*` code (never the
 * address or the link); the invitation stays pending and the admin page offers Resend.
 */
export function mailingInvitationSender(): InvitationSender {
  return async (link, recipient, details) => {
    const config = getSoftureConfig();
    const mail = renderInvitationMail(getMailMessages(config, details.locale), details.locale, {
      link,
      ttlHours: getAuthOptions(config).invitations.ttlHours,
    });
    const result = await sendMail({ config }, { to: recipient.email, ...mail });
    if (!result.ok) {
      throw new Error(`@softure-ai/auth: the invitation mail was not sent (${result.error})`);
    }
  };
}
