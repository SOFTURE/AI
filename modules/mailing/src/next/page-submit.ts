// The page's submit, shared by the route (the package page's form posts there) and the server
// action (for an app's own form): record the opt-out and name the page's outcome to send the
// browser to. No session is involved: the signature is the authorization.
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import { getMailingRoutes } from "../server/options.js";
import { unsubscribe, type SuppressionContext } from "../server/suppressions.js";
import { getUnsubscribeLinkParams, type UnsubscribeLink } from "../server/unsubscribe-link.js";
import { UNSUBSCRIBE_STATUS_PARAM, type UnsubscribeStatus } from "./params.js";

export interface PageSubmit {
  readonly config: SoftureConfig;
  readonly link: UnsubscribeLink | null;
  /** Opens the database; a failure there is a failed submit like any other. */
  readonly getContext: () => Promise<SuppressionContext>;
}

/** Records the link from the page and returns the page's outcome URL (a path with its query). */
export async function submitPageUnsubscribe({ config, link, getContext }: PageSubmit): Promise<string> {
  let status: UnsubscribeStatus;
  try {
    const result = await unsubscribe(await getContext(), link, "page");
    status = result.ok ? "done" : "invalid";
  } catch (error) {
    // The label names the kind of failure, never its text: that can carry the link's values.
    console.error(`@softure-ai/mailing: unsubscribe failed: ${errorLogLabel(error)}`);
    status = "failed";
  }
  const query = new URLSearchParams({ [UNSUBSCRIBE_STATUS_PARAM]: status });
  if (status === "failed" && link !== null) {
    // The form comes back with the same link, so the person can try again; the page strips it
    // from the address bar again.
    for (const [name, value] of Object.entries(getUnsubscribeLinkParams(link))) query.set(name, value);
  }
  return `${getMailingRoutes(config).unsubscribe}?${query.toString()}`;
}
