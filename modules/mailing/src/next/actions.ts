"use server";

// The unsubscribe page's server action. It takes the signed link from the form (the same values
// the page got in its URL), records the opt-out and redirects to the page's outcome. No session is
// involved: the signature is the authorization. Next refuses an action whose Origin does not match
// the host.
import { errorLogLabel } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { redirect } from "next/navigation";
import { getMailingRoutes } from "../server/options.js";
import { unsubscribe } from "../server/suppressions.js";
import { RECIPIENT_PARAM, readUnsubscribeToken, SIGNATURE_PARAM } from "../server/unsubscribe-link.js";
import { getMailingContext } from "./context.js";
import { UNSUBSCRIBE_STATUS_PARAM, type UnsubscribeStatus } from "./params.js";

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const config = getSoftureConfig();
  const token = readUnsubscribeToken(formData);
  let status: UnsubscribeStatus;
  try {
    const result = await unsubscribe(await getMailingContext(config), token, "page");
    status = result.ok ? "done" : "invalid";
  } catch (error) {
    // The label names the kind of failure, never its text: that can carry the link's values.
    console.error(`@softure-ai/mailing: unsubscribe failed: ${errorLogLabel(error)}`);
    status = "failed";
  }
  const query = new URLSearchParams({ [UNSUBSCRIBE_STATUS_PARAM]: status });
  if (status === "failed" && token !== null) {
    // The form comes back with the same link, so the person can try again.
    query.set(RECIPIENT_PARAM, token.recipientKey);
    query.set(SIGNATURE_PARAM, token.signature);
  }
  redirect(`${getMailingRoutes(config).unsubscribe}?${query.toString()}`);
}
