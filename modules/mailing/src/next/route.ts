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
//
// The package page's form posts here too, to the bare path with the link in its body, so the
// signed token never sits in a POST's request line (a server action would post to the page's URL,
// query included). No Origin check, as for a mail client: the signature is the authorization.
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getMailingOptions, getMailingRoutes } from "../server/options.js";
import { unsubscribe } from "../server/suppressions.js";
import { readUnsubscribeLink, type UnsubscribeLink } from "../server/unsubscribe-link.js";
import { getMailingContext } from "./context.js";
import { submitPageUnsubscribe } from "./page-submit.js";

const NO_STORE = { "cache-control": "no-store" };

/**
 * Records the opt-out of the link in the URL. The body (`List-Unsubscribe=One-Click`) is not read:
 * anyone can send it, the signature is the proof. 200 once recorded (also again), 400 for a link
 * that does not verify (200 with `mailing({ oneClickInvalidLinkStatus: 200 })`, so the answer never
 * tells whether a token is live), 500 when the database fails: the client may retry, and 200 would
 * claim an opt-out that did not happen. A legacy link (`mailing({ legacyUnsubscribe })`) is handled the same
 * way; mount this route at the old link's path too.
 *
 * A POST without a link in the URL is the unsubscribe page's form: its link comes from the form
 * body, and the answer is a 303 to the page's outcome (`?status=done`, `invalid` or `failed`).
 */
export async function postUnsubscribeRoute(request: Request): Promise<Response> {
  const config = getSoftureConfig();
  const { searchParams } = new URL(request.url);
  if (readUnsubscribeLink(searchParams, config) === null) {
    const formLink = await readFormLink(request, config);
    if (formLink !== null) {
      const location = await submitPageUnsubscribe({ config, link: formLink, getContext: () => getMailingContext(config) });
      return new Response(null, { status: 303, headers: { ...NO_STORE, location } });
    }
  }
  try {
    const ctx = await getMailingContext();
    const link = readUnsubscribeLink(searchParams, ctx.config);
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

/**
 * The page's form is URL-encoded and small (a signed link is about 100 bytes; a legacy one at most a few 512-character
 * values). A larger body is no page submit, and is not read past this size.
 */
const MAX_FORM_BYTES = 8192;
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

/** The link in a URL-encoded form body, or null for any other body. */
async function readFormLink(request: Request, config: SoftureConfig): Promise<UnsubscribeLink | null> {
  if (request.headers.get("content-type")?.toLowerCase().startsWith(FORM_CONTENT_TYPE) !== true) return null;
  const body = await readBoundedText(request, MAX_FORM_BYTES);
  return body === null ? null : readUnsubscribeLink(new URLSearchParams(body), config);
}

/** The body as text, or null when it is longer than `maxBytes` (the rest is not read) or cannot be read. */
async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    // A client that drops the connection mid-body: no form to read.
    return null;
  }
  return Buffer.concat(chunks).toString("utf8");
}
