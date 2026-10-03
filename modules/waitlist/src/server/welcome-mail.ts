// The welcome mail: sent at most once per sign-up through mailing's delivery ledger, as list mail
// (kind `waitlist`), so it carries mailing's unsubscribe footer and headers and is never sent to an
// address that unsubscribed. The copy comes from the module's messages in the sign-up's locale.
import { isLocale, type SoftureConfig } from "@softure-ai/core";
import { deliverOnce, type DeliveryOutcome } from "@softure-ai/mailing/server";
import type { WaitlistSignup } from "../contract.js";
import type { WaitlistMessages } from "../messages/index.js";
import { getWaitlistModule, getWaitlistOptions } from "./options.js";
import type { WaitlistContext } from "./signups.js";

/** The mailing kind of the waitlist's mail: list mail, which an unsubscribe stops. */
export const WAITLIST_MAIL_KIND = "waitlist";

/** The delivery scope of a sign-up's welcome mail in mailing.deliveries. */
export function getWelcomeMailScope(signupId: string): string {
  return `waitlist.welcome:${signupId}`;
}

function getMessages(config: SoftureConfig, locale: string): WaitlistMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getWaitlistModule(config).messages[isLocale(locale) ? locale : config.locale] as WaitlistMessages;
}

/**
 * Sends the welcome mail of `signup` unless the ledger already holds an outcome for it (a repeat
 * sign-up retries one that was `retry-later`); `skipped` with `waitlist({ welcomeMail: false })`.
 * Database errors propagate (`deliverOnce`).
 */
export async function deliverWelcomeMail(ctx: WaitlistContext, signup: WaitlistSignup): Promise<DeliveryOutcome | { readonly status: "skipped" }> {
  if (!getWaitlistOptions(ctx.config).welcomeMail) return { status: "skipped" };
  const messages = getMessages(ctx.config, signup.locale);
  return deliverOnce(ctx, {
    scope: getWelcomeMailScope(signup.id),
    mail: { to: signup.email, subject: messages.welcomeMail.subject, text: messages.welcomeMail.text, kind: WAITLIST_MAIL_KIND },
  });
}
