// The welcome mail: sent at most once per sign-up through mailing's delivery ledger, as list mail
// (kind `waitlist`), so it carries mailing's unsubscribe footer and headers and is never sent to an
// address that unsubscribed, nor to a sign-up that waits for its confirmation. The copy comes from
// the module's messages in the sign-up's locale.
import { deliverOnce, type DeliveryOutcome } from "@softure-ai/mailing/server";
import type { WaitlistSignup } from "../contract.js";
import { getWaitlistMessagesIn, getWaitlistOptions } from "./options.js";
import type { WaitlistContext } from "./signups.js";

/** The mailing kind of the waitlist's mail: list mail, which an unsubscribe stops. */
export const WAITLIST_MAIL_KIND = "waitlist";

/** The delivery scope of a sign-up's welcome mail in mailing.deliveries. */
export function getWelcomeMailScope(signupId: string): string {
  return `waitlist.welcome:${signupId}`;
}

/**
 * Sends the welcome mail of `signup` unless the ledger already holds an outcome for it (a repeat
 * sign-up retries one that was `retry-later`); `skipped` with `waitlist({ welcomeMail: false })` and
 * for a sign-up not confirmed yet (list mail goes to confirmed ones only).
 * Database errors propagate (`deliverOnce`).
 */
export async function deliverWelcomeMail(ctx: WaitlistContext, signup: WaitlistSignup): Promise<DeliveryOutcome | { readonly status: "skipped" }> {
  if (!getWaitlistOptions(ctx.config).welcomeMail || signup.confirmedAt === null) return { status: "skipped" };
  const messages = getWaitlistMessagesIn(ctx.config, signup.locale);
  return deliverOnce(ctx, {
    scope: getWelcomeMailScope(signup.id),
    mail: { to: signup.email, subject: messages.welcomeMail.subject, text: messages.welcomeMail.text, kind: WAITLIST_MAIL_KIND },
  });
}
