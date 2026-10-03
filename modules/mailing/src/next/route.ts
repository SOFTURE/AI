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
import { getMailingRoutes } from "../server/options.js";
import { unsubscribe } from "../server/suppressions.js";
import { readUnsubscribeToken } from "../server/unsubscribe-link.js";
import { getMailingContext } from "./context.js";

const NO_STORE = { "cache-control": "no-store" };

/**
 * Records the opt-out of the link in the URL. The body (`List-Unsubscribe=One-Click`) is not read:
 * anyone can send it, the signature is the proof. 200 once recorded (also again), 400 for a link
 * that does not verify, 500 when the database fails: the client may retry, and 200 would claim an
 * opt-out that did not happen.
 */
export async function postUnsubscribeRoute(request: Request): Promise<Response> {
  const token = readUnsubscribeToken(new URL(request.url).searchParams);
  try {
    const result = await unsubscribe(await getMailingContext(), token, "one-click");
    return new Response(null, { status: result.ok ? 200 : 400, headers: NO_STORE });
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
