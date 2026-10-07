// The RFC 8058 one-click route. Mount both handlers with a rename in
// app/api/mailing/unsubscribe/route.ts:
// `export { postUnsubscribeRoute as POST, getUnsubscribeRoute as GET } from "@softure-ai/mailing/next"`.
//
// Mail clients (Gmail, Outlook, Apple Mail) POST here from their own servers: no cookies, no
// server action id, a foreign Origin. That is why this is a route handler and not an action. It
// needs no session and must stay outside any auth guard. There is no per-IP rate limit on
// purpose: a few provider addresses act for millions of people, so a bucket would refuse real
// unsubscribes. The link is checked by shape and signature before the database is touched, and
// the only write is an idempotent insert.
import { errorLogLabel } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getMailingOptions, getMailingRoutes } from "../server/options.js";
import { unsubscribe } from "../server/suppressions.js";
import { readUnsubscribeLink } from "../server/unsubscribe-link.js";
import { getMailingContext } from "./context.js";

const NO_STORE = { "cache-control": "no-store" };

/**
 * Records the opt-out of the link in the URL. The body (`List-Unsubscribe=One-Click`) is not read:
 * anyone can send it, the signature is the proof. 200 once recorded (also again), 400 for a link
 * that does not verify (200 with `mailing({ oneClickInvalidLinkStatus: 200 })`, so the answer never
 * tells whether a token is live), 500 when the database fails: the client may retry, and 200 would
 * claim an opt-out that did not happen. A legacy link (`mailing({ legacyUnsubscribe })`) is handled the same
 * way; mount this route at the old link's path too.
 */
export async function postUnsubscribeRoute(request: Request): Promise<Response> {
  try {
    const ctx = await getMailingContext();
    const link = readUnsubscribeLink(new URL(request.url).searchParams, ctx.config);
    const result = await unsubscribe(ctx, link, "one-click");
    return new Response(null, { status: result.ok ? 200 : getMailingOptions(ctx.config).oneClickInvalidLinkStatus, headers: NO_STORE });
  } catch (error) {
    console.error(`@softure-ai/mailing: one-click unsubscribe failed: ${errorLogLabel(error)}`);
    return new Response(null, { status: 500, headers: NO_STORE });
  }
}

/**
 * A client without RFC 8058 opens the header's URL in a browser: send it to the page with the
 * same link (303, so nothing changes on GET). A 405 would also put the token in access logs that
 * record failed requests.
 */
export function getUnsubscribeRoute(request: Request): Response {
  const { search } = new URL(request.url);
  return new Response(null, { status: 303, headers: { ...NO_STORE, location: `${getMailingRoutes(getSoftureConfig()).unsubscribe}${search}` } });
}
