// The welcome mail: sent at most once per sign-up through mailing's delivery ledger, as list mail
// (kind `waitlist`), so it carries mailing's unsubscribe footer and headers and is never sent to an
// address that unsubscribed, nor to a sign-up that waits for its confirmation. The copy comes from
// the module's messages in the sign-up's locale; the HTML body from the app's `mailTemplate` or the
// module's default.
import { deliverOnce, type DeliveryOutcome } from "@softure-ai/mailing/server";
import type { WaitlistSignup } from "../contract.js";
import { renderMailHtml } from "./mail-html.js";
import { getWaitlistMessagesIn, getWaitlistOptions, resolveLocale } from "./options.js";
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
 * Database errors and a failing `mailTemplate` propagate.
 */
export async function deliverWelcomeMail(ctx: WaitlistContext, signup: WaitlistSignup): Promise<DeliveryOutcome | { readonly status: "skipped" }> {
  if (!getWaitlistOptions(ctx.config).welcomeMail || signup.confirmedAt === null) return { status: "skipped" };
  const { subject, text } = getWaitlistMessagesIn(ctx.config, signup.locale).welcomeMail;
  const html = renderMailHtml(ctx.config, { kind: "welcome", locale: resolveLocale(ctx.config, signup.locale), subject, text });
  return deliverOnce(ctx, {
    scope: getWelcomeMailScope(signup.id),
    mail: { to: signup.email, subject, text, html, kind: WAITLIST_MAIL_KIND },
  });
}
