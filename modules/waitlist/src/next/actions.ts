"use server";

// The join action of the waitlist form. It identifies the client and counts its attempt (inside
// `joinWaitlist`) before any work, answers the same for a new and a known address, and sends the
// welcome mail after the response, so neither the mail's time nor its failure shows in the answer.
// Unexpected failures become `safeError` codes. Next refuses an action whose Origin does not match
// the host.
import { errorLogLabel, safeError } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { identifyClient } from "@softure-ai/security/server";
import { headers } from "next/headers";
import { after } from "next/server";
import type { WaitlistFormErrorCode, WaitlistFormState } from "../contract.js";
import { EMAIL_FIELD, getScopeFieldName, PLACEMENT_FIELD } from "../fields.js";
import { getWaitlistOptions } from "../server/options.js";
import { joinWaitlist } from "../server/signups.js";
import { deliverWelcomeMail } from "../server/welcome-mail.js";
import { getWaitlistContext } from "./context.js";

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

  let result;
  try {
    result = await joinWaitlist(await getWaitlistContext(config), { email, scopes, placement: readText(formData, PLACEMENT_FIELD), clientKey: client.value });
  } catch (error) {
    return { status: "error", error: reportFailure("joining the waitlist", error), ...echo };
  }
  if (!result.ok) {
    const field = result.error === "waitlist.email_invalid" ? "email" : result.error === "waitlist.consent_required" ? "consent" : undefined;
    return { status: "error", error: result.error, ...(field === undefined ? {} : { field }), ...echo };
  }

  const { signup } = result.value;
  after(async () => {
    try {
      const outcome = await deliverWelcomeMail(await getWaitlistContext(config), signup);
      // An address that unsubscribed is refused on purpose; anything else is worth a log line.
      if (outcome.status === "rejected" && outcome.reason !== "mailing.suppressed") console.error(`@softure-ai/waitlist: the welcome mail was refused: ${outcome.reason}`);
    } catch (error) {
      reportFailure("the welcome mail", error);
    }
  });
  return { status: "ok" };
}
