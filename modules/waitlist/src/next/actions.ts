"use server";

// The waitlist's server actions: the form's join and the confirmation page's confirm. Each
// identifies the client and counts its attempt (inside the server function) before any work. The
// join answers the same for a new, a known and a suppressed address and sends its mail (the welcome
// mail, or the confirmation link with double opt-in) after the response, so neither the mail's time
// nor its failure shows in the answer. Unexpected failures become `safeError` codes. Next refuses an action
// whose Origin does not match the host.
import { errorLogLabel, safeError, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { buildUnsubscribeLinks, readUnsubscribeSecrets } from "@softure-ai/mailing/server";
import { identifyClient } from "@softure-ai/security/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { WaitlistFormErrorCode, WaitlistFormState } from "../contract.js";
import { EMAIL_FIELD, getScopeFieldName, PLACEMENT_FIELD } from "../fields.js";
import { CONFIRMATION_TOKEN_PARAM, deliverConfirmationMail } from "../server/confirmation-mail.js";
import { getWaitlistOptions, getWaitlistRoutes } from "../server/options.js";
import { confirmSignup, isChannel, joinWaitlist } from "../server/signups.js";
import { deliverWelcomeMail } from "../server/welcome-mail.js";
import type { WaitlistSignup } from "../contract.js";
import { getWaitlistContext } from "./context.js";
import { CONFIRM_STATUS_PARAM, type ConfirmStatus } from "./params.js";

/** Longer values are cut: the server functions refuse them anyway, and nothing huge is echoed back. */
const MAX_FIELD_LENGTH = 512;

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : "";
}

function reportFailure(operation: string, error: unknown): WaitlistFormErrorCode {
  console.error(`@softure-ai/waitlist: ${operation} failed: ${errorLogLabel(error)}`);
  return safeError(error).error;
}

export async function joinWaitlistAction(_previous: WaitlistFormState, formData: FormData): Promise<WaitlistFormState> {
  const config = getSoftureConfig();
  const email = readText(formData, EMAIL_FIELD);
  // A checked checkbox sends its field; an unchecked one sends nothing. Only declared scopes are read.
  const scopes = getWaitlistOptions(config)
    .scopes.map((scope) => scope.id)
    .filter((id) => formData.has(getScopeFieldName(id)));
  const echo = { email, scopes };
  const client = identifyClient({ config }, await headers());
  if (!client.ok) return { status: "error", error: client.error, ...echo };

  const channel = await resolveRequestChannel(config);
  let result;
  try {
    result = await joinWaitlist(await getWaitlistContext(config), { email, scopes, placement: readText(formData, PLACEMENT_FIELD), clientKey: client.value, channel });
  } catch (error) {
    return { status: "error", error: reportFailure("joining the waitlist", error), ...echo };
  }
  if (!result.ok) {
    const field = result.error === "waitlist.email_invalid" ? "email" : result.error === "waitlist.consent_required" ? "consent" : undefined;
    return { status: "error", error: result.error, ...(field === undefined ? {} : { field }), ...echo };
  }

  const joined = result.value;
  if (joined.status === "confirmation_required") {
    after(async () => {
      try {
        const sent = await deliverConfirmationMail(await getWaitlistContext(config), joined.signup, joined.token);
        if (!sent.ok) console.error(`@softure-ai/waitlist: the confirmation mail was refused: ${sent.error}`);
      } catch (error) {
        reportFailure("the confirmation mail", error);
      }
    });
    return { status: "confirmation_sent" };
  }
  // A suppressed address (no double opt-in) wrote nothing; it answers as a sign-up that counted, so
  // the form does not tell who unsubscribed, and gets no mail.
  if (joined.status === "joined") sendWelcomeMailAfter(config, joined.signup);
  return { status: "ok", ...getUnsubscribeUrl(config, email) };
}

/** The person's own unsubscribe link, when the app asks for it (the setup check required the secret). */
function getUnsubscribeUrl(config: SoftureConfig, email: string): { unsubscribeUrl?: string } {
  if (!getWaitlistOptions(config).unsubscribeLinkOnSuccess) return {};
  const secret = readUnsubscribeSecrets().current;
  return secret === null ? {} : { unsubscribeUrl: buildUnsubscribeLinks(config, email, secret).page };
}

/** The app's channel for this request, or null: attribution never blocks a sign-up. */
async function resolveRequestChannel(config: SoftureConfig): Promise<string | null> {
  const resolve = getWaitlistOptions(config).resolveChannel;
  if (resolve === undefined) return null;
  let channel: unknown;
  try {
    channel = await resolve({ config });
  } catch (error) {
    reportFailure("resolving the channel", error);
    return null;
  }
  if (channel === null) return null;
  if (typeof channel === "string" && isChannel(channel)) return channel;
  console.error("@softure-ai/waitlist: resolveChannel returned a value that is not a channel (1-64 visible ASCII characters); the sign-up is stored without one");
  return null;
}

/** Sends the welcome mail after the response; it goes out once per sign-up whoever calls. */
function sendWelcomeMailAfter(config: SoftureConfig, signup: WaitlistSignup): void {
  after(async () => {
    try {
      const outcome = await deliverWelcomeMail(await getWaitlistContext(config), signup);
      // An address that unsubscribed is refused on purpose; anything else is worth a log line.
      if (outcome.status === "rejected" && outcome.reason !== "mailing.suppressed") console.error(`@softure-ai/waitlist: the welcome mail was refused: ${outcome.reason}`);
    } catch (error) {
      reportFailure("the welcome mail", error);
    }
  });
}

/**
 * The confirmation page's action: confirms the link's request and redirects to the page's outcome.
 * No session is involved: the link's token is the authorization. A failure that a retry can fix
 * keeps the token in the redirect, so the button comes back.
 */
export async function confirmSignupAction(formData: FormData): Promise<void> {
  const config = getSoftureConfig();
  const token = readText(formData, CONFIRMATION_TOKEN_PARAM);
  let status: ConfirmStatus;
  const client = identifyClient({ config }, await headers());
  if (!client.ok) {
    status = "failed";
  } else {
    try {
      const result = await confirmSignup(await getWaitlistContext(config), { token, clientKey: client.value });
      if (result.ok) {
        status = "done";
        sendWelcomeMailAfter(config, result.value.signup);
      } else {
        status = result.error === "security.rate_limited" ? "limited" : result.error === "waitlist.confirmation_expired" ? "expired" : "invalid";
      }
    } catch (error) {
      // The label names the kind of failure, never its text: that can carry the token.
      console.error(`@softure-ai/waitlist: confirming a sign-up failed: ${errorLogLabel(error)}`);
      status = "failed";
    }
  }
  const query = new URLSearchParams({ [CONFIRM_STATUS_PARAM]: status });
  if (status === "failed" || status === "limited") query.set(CONFIRMATION_TOKEN_PARAM, token);
  redirect(`${getWaitlistRoutes(config).confirm}?${query.toString()}`);
}
