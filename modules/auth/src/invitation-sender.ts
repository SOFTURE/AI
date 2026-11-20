// The hook through which auth hands an invitation link to the app, which delivers it (a mail, e.g. through
// `mailingInvitationSender()` of `@softure-ai/auth/mailing`). Auth never sends anything itself.
import type { Locale } from "@softure-ai/core";

export interface InvitationDetails {
  /** When the link stops working. */
  readonly expiresAt: Date;
  /** The app's locale, for the copy of the message. */
  readonly locale: Locale;
  /** The roles the account will hold. */
  readonly roles: readonly string[];
}

/**
 * Delivers an invitation link to `recipient.email`. The link is built on `appOrigin` (never on the request's Host). It
 * runs in the admin's request, so a failure shows on the invitations page and the admin can resend; a thrown error is
 * logged without the link.
 */
export type InvitationSender = (link: string, recipient: { readonly email: string }, details: InvitationDetails) => Promise<void>;

/**
 * A development sender that prints the link to the server console. It refuses to run in production, where an
 * invitation link in the logs would be a live credential in the logs.
 */
export const consoleInvitationSender: InvitationSender = (link, recipient, details) => {
  if (process.env.NODE_ENV === "production") {
    return Promise.reject(
      new Error("@softure-ai/auth: consoleInvitationSender is for development only; pass a real sender to auth({ invitations: { send } })"),
    );
  }
  console.info(`@softure-ai/auth: invitation link for ${recipient.email}, valid until ${details.expiresAt.toISOString()}: ${link}`);
  return Promise.resolve();
};
