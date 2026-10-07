// The public funnel endpoint: a POST beacon from the browser (`navigator.sendBeacon`, body
// `step=<id>`) and a GET pixel (an image on a page, `?step=<id>`). Both take Web `Request`s and
// return `Response`s, so the Next adapter only supplies the context.
//
// Bad input is not an error: an unknown step, a step of another kind, a body too large or a request
// that did not come from one of this app's pages gets the same answer as a counted one (204, or the
// pixel). A scanner gets no oracle, and access logs that record every 4xx do not fill with noise.
// The only other answer is 503, when the count did not reach the database.
//
// The wire format is configurable (`funnel.wire`): the step may come under several field names, so
// pages cached with an older format keep counting, and with `channelField` a page may send its channel
// itself. That channel is no less trusted than the Referer's: both come from the client.
//
// The origin check is a noise filter, not a defence: headers come from the client, and a forged
// Referer passes. The counts are anonymous statistics, inflating them opens nothing, and the daily
// channel cap bounds the table's growth. There is no per-address rate limit on purpose: it would
// store the address of every visitor, and the module promises to store none.
import type { SoftureConfig } from "@softure-ai/core";
import { readSmallBody } from "@softure-ai/security";
import { deriveChannel, isFirstParty, parseChannel, readChannel } from "./channel.js";
import { findPublicStep, recordFunnelStepQuietly, type AnalyticsContext } from "./funnel.js";
import { getAnalyticsOptions } from "./options.js";

/** The beacon's body is `step=<id>`; anything larger is not a beacon. */
export const MAX_BEACON_BYTES = 256;
/** The default field (body of a beacon, query of a pixel) that names the step: `funnel.wire.stepFields[0]`. */
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
  return countStep(ctx, new URLSearchParams(body.value), visit, "beacon");
}

async function countPixel(ctx: AnalyticsContext, request: Request): Promise<boolean> {
  const visit = readVisit(ctx.config, request);
  if (visit === null) return true;
  return countStep(ctx, new URL(request.url).searchParams, visit, "pixel");
}

/** Counts the step `fields` name for a visit, with the channel the fields, the page or its path give. */
async function countStep(ctx: AnalyticsContext, fields: URLSearchParams, visit: Visit, via: "beacon" | "pixel"): Promise<boolean> {
  const { funnel, channel: channelOptions } = getAnalyticsOptions(ctx.config);
  const step = findPublicStep(funnel.steps, readStep(fields, funnel.wire.stepFields), via);
  if (step === null) return true;
  const sent = funnel.wire.channelField === null ? null : parseChannel(readSingle(fields, funnel.wire.channelField), channelOptions);
  const channel = sent ?? visit.channel ?? deriveChannel(ctx.config, { hook: funnel.channelFromReferer, label: "funnel.channelFromReferer" }, visit.page);
  return recordFunnelStepQuietly(ctx, { step: step.id, channel });
}

interface Visit {
  /** The channel tag of the page the request came from. */
  readonly channel: string | null;
  /** That page, for `channelFromReferer`. */
  readonly page: URL;
}

/**
 * The visit a request reports for: sent from a page on one of this app's origins (`Referer`, and
 * `Sec-Fetch-Site` when the browser sends it), with that page's channel. Behind a proxy `request.url`
 * carries the server's own host, so the configured origins decide, not the request URL alone. Null
 * for anything else: crawlers, previews and tools fetching the URL directly send no Referer.
 */
function readVisit(config: SoftureConfig, request: Request): Visit | null {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return null;
  const referer = request.headers.get("referer");
  if (referer === null || !URL.canParse(referer)) return null;
  // The request's own query never decides the channel: only the page it came from does.
  const url = new URL(request.url);
  url.search = "";
  const page = new URL(referer);
  if (!isFirstParty(page, { config, url, host: null })) return null;
  return { channel: readChannel(config, { url, referer }), page };
}

/** The step when exactly one value appears across the step fields; two of them name no step. */
function readStep(params: URLSearchParams, fields: readonly string[]): string | null {
  const values = fields.flatMap((field) => params.getAll(field));
  return values.length === 1 ? (values[0] ?? null) : null;
}

/** The field's value when it appears exactly once. */
function readSingle(params: URLSearchParams, field: string): string | null {
  const values = params.getAll(field);
  return values.length === 1 ? (values[0] ?? null) : null;
}
