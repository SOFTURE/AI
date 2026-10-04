// The confirmation mail of double opt-in: the link that makes a sign-up count. It is transactional
// mail, because it answers the person's own request and must reach an address that opted out of
// list mail before (signing up again is how they opt back in). The token is a credential: it goes
// into the mail and nowhere else. The app may rewrite the link's path (`rewriteConfirmationLink`),
// e.g. to keep the analytics channel tag through the mail, but never so that it stops confirming.
import { TRANSACTIONAL_KIND, type SendMailResult } from "@softure-ai/mailing";
import { sendMail } from "@softure-ai/mailing/server";
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import type { WaitlistSignup } from "../contract.js";
import { renderMailHtml } from "./mail-html.js";
import { getWaitlistMessagesIn, getWaitlistOptions, getWaitlistRoutes, resolveLocale } from "./options.js";
import type { WaitlistContext } from "./signups.js";

/** The query parameter of the confirmation link that carries the token. */
export const CONFIRMATION_TOKEN_PARAM = "token";

/** The confirmation page with `token`, on the app's origin. */
export function getConfirmationLink(config: SoftureConfig, token: string): string {
  return `${config.appOrigin}${getConfirmationPath(config, token)}`;
}

function getConfirmationPath(config: SoftureConfig, token: string): string {
  const query = new URLSearchParams({ [CONFIRMATION_TOKEN_PARAM]: token });
  return `${getWaitlistRoutes(config).confirm}?${query.toString()}`;
}

/**
 * The confirmation link as the app's `rewriteConfirmationLink` returns it, on the app's origin. A
 * result that is not the confirm route on this app with the same token, or a rewrite that throws,
 * gives `getConfirmationLink` instead (with a log line): the link must always confirm.
 */
export async function resolveConfirmationLink(config: SoftureConfig, token: string): Promise<string> {
  const { rewriteConfirmationLink } = getWaitlistOptions(config);
  const path = getConfirmationPath(config, token);
  if (rewriteConfirmationLink === undefined) return `${config.appOrigin}${path}`;
  try {
    const rewritten = await rewriteConfirmationLink(path, { config });
    if (isConfirmationPath(config, rewritten, token)) return `${config.appOrigin}${rewritten}`;
    console.error("@softure-ai/waitlist: rewriteConfirmationLink returned a path that is not the confirm route with its token; the module's link is used");
  } catch (error) {
    console.error(`@softure-ai/waitlist: rewriting the confirmation link failed: ${errorLogLabel(error)}`);
  }
  return `${config.appOrigin}${path}`;
}

/** Whether `path` is the confirm route on this app (a path, not a URL) carrying `token`. */
function isConfirmationPath(config: SoftureConfig, path: unknown, token: string): path is string {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
  const origin = new URL(config.appOrigin).origin;
  if (!URL.canParse(path, origin)) return false;
  const url = new URL(path, origin);
  return url.origin === origin && url.pathname === getWaitlistRoutes(config).confirm && url.searchParams.getAll(CONFIRMATION_TOKEN_PARAM).join() === token;
}

/**
 * Mails the confirmation link of a request (`joinWaitlist` answered `confirmation_required`) in the
 * sign-up's locale, as text (the link on its last line) and HTML (the link as an anchor). Returns
 * mailing's result; nothing is retried, a new sign-up sends a new link. A failing `mailTemplate` throws.
 * The app's `rewriteConfirmationLink` runs here (in the join action, inside `after()`).
 */
export async function deliverConfirmationMail(ctx: WaitlistContext, signup: WaitlistSignup, token: string): Promise<SendMailResult> {
  const messages = getWaitlistMessagesIn(ctx.config, signup.locale).confirmationMail;
  const link = await resolveConfirmationLink(ctx.config, token);
  const html = renderMailHtml(ctx.config, {
    kind: "confirmation",
    locale: resolveLocale(ctx.config, signup.locale),
    subject: messages.subject,
    text: messages.text,
    action: { href: link, label: messages.action },
  });
  return sendMail(ctx, { to: signup.email, subject: messages.subject, text: `${messages.text}\n\n${link}`, html, kind: TRANSACTIONAL_KIND });
}
