// The GET shared by the guarded page fetch and the guarded download: the SSRF guard of `sendGuardedRequest` on
// the first URL and on every redirect hop, the decoding of `content-encoding`, and the parsing of `content-type`.
// The caller owns the time limit: it tears down the hop it is told about when its timer fires.
import type { ClientRequest, IncomingMessage } from "node:http";
import { pipeline, type Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { checkGuardedUrl, openGuardedRequest, type GuardedRequestErrorCode, type GuardedRequestSeam } from "./guarded-request.js";

/** A failure inside a guarded GET, carried to the one place that turns it into a code. */
export class GuardedFetchError extends Error {
  constructor(readonly code: GuardedRequestErrorCode | "security.outbound_too_large") {
    super(`guarded fetch: ${code}`);
    this.name = "GuardedFetchError";
  }
}

/** The hop in flight, so the caller's timer can tear it down. */
export interface OpenHop {
  request: ClientRequest;
  response?: IncomingMessage;
}

export interface FollowOptions {
  readonly headers: Readonly<Record<string, string>>;
  readonly allowedPorts: readonly number[];
  readonly maxRedirects: number;
  readonly isAllowedAddress: (address: string) => boolean;
  /** Every hop, the first one included, must be `https:`. */
  readonly requireHttps: boolean;
}

export interface ReachedResponse {
  readonly target: URL;
  readonly response: IncomingMessage;
  readonly status: number;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Sends the GET and follows redirects, each `Location` resolved against the hop it came from and checked like the
 * first URL. Returns the response that is not a followed redirect. More than `maxRedirects` hops is
 * `security.outbound_failed`; `maxRedirects` 0 returns a 3xx as it is. A lookup refusal or a network failure throws
 * (the caller maps it); `onHop` hears of each hop before it is awaited.
 */
export async function followGuardedRedirects(
  url: string,
  options: FollowOptions,
  seam: GuardedRequestSeam,
  onHop: (hop: OpenHop) => void,
): Promise<Ok<ReachedResponse> | Err<GuardedRequestErrorCode>> {
  const { headers, maxRedirects } = options;
  let checked = checkHop(url, options);
  for (let hop = 0; ; hop += 1) {
    if (!checked.ok) {
      return checked;
    }
    const target = checked.value;
    let request: ClientRequest;
    try {
      request = openGuardedRequest(target, { method: "GET", headers }, seam);
    } catch {
      return err("security.outbound_failed");
    }
    const open: OpenHop = { request };
    onHop(open);
    const response = await awaitResponse(request);
    open.response = response;

    const status = response.statusCode ?? 0;
    const location = response.headers.location;
    if (REDIRECT_STATUSES.has(status) && location !== undefined && maxRedirects > 0) {
      // `agent: false`: the hop's socket is closed here, not kept for the next one.
      response.destroy();
      if (hop >= maxRedirects) {
        return err("security.outbound_failed");
      }
      checked = checkHop(location, options, target);
      continue;
    }
    return ok({ target, response, status });
  }
}

/** The checks of `checkGuardedUrl`, after the scheme rule of `requireHttps`, so plain http is named as such. */
function checkHop(url: string, options: FollowOptions, base?: URL): Ok<URL> | Err<"security.outbound_invalid_url" | "security.outbound_blocked"> {
  if (options.requireHttps && URL.parse(url, base)?.protocol === "http:") {
    return err("security.outbound_invalid_url");
  }
  return checkGuardedUrl(url, options.allowedPorts, options.isAllowedAddress, base);
}

function awaitResponse(request: ClientRequest): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    request.once("response", resolve);
    request.once("error", reject);
    request.end();
  });
}

/** The body through its `content-encoding`; an encoding the fetch cannot undo throws `security.outbound_failed`. */
export function decodeBody(response: IncomingMessage): Readable {
  const encoding = (response.headers["content-encoding"] ?? "identity").trim().toLowerCase();
  const decoder =
    encoding === "gzip" || encoding === "x-gzip"
      ? createGunzip()
      : encoding === "deflate"
        ? createInflate()
        : encoding === "br"
          ? createBrotliDecompress()
          : encoding === "identity" || encoding === ""
            ? null
            : undefined;
  if (decoder === undefined) {
    // An encoding the fetch did not ask for and cannot undo: the bytes would not be the resource.
    throw new GuardedFetchError("security.outbound_failed");
  }
  if (decoder === null) {
    return response;
  }
  // The pipeline carries an error of either side to the decoder, where the read loop sees it.
  return pipeline(response, decoder, () => undefined);
}

/** The media type in lowercase without parameters, and the declared charset label, each `null` when absent. */
export function parseContentType(header: string | undefined): { contentType: string | null; charset: string | null } {
  if (header === undefined) {
    return { contentType: null, charset: null };
  }
  const [type = "", ...parameters] = header.split(";");
  const contentType = type.trim().toLowerCase();
  const charsetParameter = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.toLowerCase().startsWith("charset="));
  const charset = charsetParameter?.slice("charset=".length).trim().replace(/^"|"$/g, "").toLowerCase();
  return { contentType: contentType === "" ? null : contentType, charset: charset === undefined || charset === "" ? null : charset };
}
