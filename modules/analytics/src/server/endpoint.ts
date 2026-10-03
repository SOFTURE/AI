// The public funnel endpoint (FIRE_TRACKER `src/app/actions/do-funnel.ts` and its route): a POST
// beacon from the browser (`navigator.sendBeacon`, body `step=<id>`) and a GET pixel (an image on
// a page, `?step=<id>`). Both take Web `Request`s and return `Response`s, so the Next adapter only
// supplies the context.
//
// Bad input is not an error: an unknown step, a step of another kind, a body too large or a request
// that did not come from one of this app's pages gets the same answer as a counted one (204, or the
// pixel). A scanner gets no oracle, and access logs that record every 4xx do not fill with noise.
// The only other answer is 503, when the count did not reach the database.
//
// The origin check is a noise filter, not a defence: headers come from the client, and a forged
// Referer passes. The counts are anonymous statistics, inflating them opens nothing, and the daily
// channel cap bounds the table's growth. There is no per-address rate limit on purpose: it would
// store the address of every visitor, and the module promises to store none.
import type { SoftureConfig } from "@softure-ai/core";
import { readSmallBody } from "@softure-ai/security";
import { isFirstParty, readChannel } from "./channel.js";
import { findPublicStep, recordFunnelStepQuietly, type AnalyticsContext } from "./funnel.js";
import { getAnalyticsOptions } from "./options.js";

/** The beacon's body is `step=<id>`; anything larger is not a beacon. */
export const MAX_BEACON_BYTES = 256;
/** The field (body of a beacon, query of a pixel) that names the step. */
export const STEP_FIELD = "step";

const NO_STORE = { "cache-control": "no-store" };
/** A transparent 1×1 GIF: the smallest image every browser accepts. */
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (character) => character.charCodeAt(0));

/** `POST`: a beacon step reported by a page of this app. */
export async function handleFunnelBeacon(ctx: AnalyticsContext, request: Request): Promise<Response> {
  const counted = await countBeacon(ctx, request);
  return new Response(null, { status: counted ? 204 : 503, headers: NO_STORE });
}

/** `GET`: a pixel step requested by an image on a page of this app. */
export async function handleFunnelPixel(ctx: AnalyticsContext, request: Request): Promise<Response> {
  const counted = await countPixel(ctx, request);
  if (!counted) return new Response(null, { status: 503, headers: NO_STORE });
  return new Response(PIXEL, { status: 200, headers: { ...NO_STORE, "content-type": "image/gif" } });
}

/** False only when a count failed in the database; ignored input counts as handled. */
async function countBeacon(ctx: AnalyticsContext, request: Request): Promise<boolean> {
  const visit = readVisit(ctx.config, request);
  if (visit === null) return true;
  const body = await readSmallBody(request, { maxBytes: MAX_BEACON_BYTES });
  if (!body.ok) return true;
  const step = findPublicStep(getAnalyticsOptions(ctx.config).funnel.steps, readSingle(new URLSearchParams(body.value)), "beacon");
  if (step === null) return true;
  return recordFunnelStepQuietly(ctx, { step: step.id, channel: visit.channel });
}

async function countPixel(ctx: AnalyticsContext, request: Request): Promise<boolean> {
  const visit = readVisit(ctx.config, request);
  if (visit === null) return true;
  const step = findPublicStep(getAnalyticsOptions(ctx.config).funnel.steps, readSingle(new URL(request.url).searchParams), "pixel");
  if (step === null) return true;
  return recordFunnelStepQuietly(ctx, { step: step.id, channel: visit.channel });
}

/**
 * The visit a request reports for: sent from a page of this app (`Referer`, and `Sec-Fetch-Site`
 * when the browser sends it), with that page's channel. Null for anything else: crawlers, previews
 * and tools fetching the URL directly send no Referer.
 */
function readVisit(config: SoftureConfig, request: Request): { readonly channel: string | null } | null {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return null;
  const referer = request.headers.get("referer");
  if (referer === null || !URL.canParse(referer)) return null;
  // The request's own query never decides the channel: only the page it came from does.
  const url = new URL(request.url);
  url.search = "";
  if (!isFirstParty(new URL(referer), { config, url, host: null })) return null;
  return { channel: readChannel(config, { url, referer }) };
}

/** The step field when it appears exactly once; two of them name no step. */
function readSingle(params: URLSearchParams): string | null {
  const values = params.getAll(STEP_FIELD);
  return values.length === 1 ? (values[0] ?? null) : null;
}
