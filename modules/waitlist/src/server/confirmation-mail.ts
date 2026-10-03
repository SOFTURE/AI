// The confirmation mail of double opt-in: the link that makes a sign-up count. It is transactional
// mail, because it answers the person's own request and must reach an address that opted out of
// list mail before (signing up again is how they opt back in). The token is a credential: it goes
// into the mail and nowhere else.
import { TRANSACTIONAL_KIND, type SendMailResult } from "@softure-ai/mailing";
import { sendMail } from "@softure-ai/mailing/server";
import type { SoftureConfig } from "@softure-ai/core";
import type { WaitlistSignup } from "../contract.js";
import { getWaitlistMessagesIn, getWaitlistRoutes } from "./options.js";
import type { WaitlistContext } from "./signups.js";

/** The query parameter of the confirmation link that carries the token. */
export const CONFIRMATION_TOKEN_PARAM = "token";

/** The confirmation page with `token`, on the app's origin. */
export function getConfirmationLink(config: SoftureConfig, token: string): string {
  const query = new URLSearchParams({ [CONFIRMATION_TOKEN_PARAM]: token });
  return `${config.appOrigin}${getWaitlistRoutes(config).confirm}?${query.toString()}`;
}

/**
 * Mails the confirmation link of a request (`joinWaitlist` answered `confirmation_required`) in the
 * sign-up's locale. Returns mailing's result; nothing is retried, a new sign-up sends a new link.
 */
export async function deliverConfirmationMail(ctx: WaitlistContext, signup: WaitlistSignup, token: string): Promise<SendMailResult> {
  const messages = getWaitlistMessagesIn(ctx.config, signup.locale).confirmationMail;
  const text = `${messages.text}\n\n${getConfirmationLink(ctx.config, token)}`;
  return sendMail(ctx, { to: signup.email, subject: messages.subject, text, kind: TRANSACTIONAL_KIND });
}
