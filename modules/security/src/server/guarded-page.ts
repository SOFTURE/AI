// A GET of a page at a URL someone else chose (a saved link, a link preview, a page to summarize), with the
// same SSRF guard as `sendGuardedRequest` on every redirect hop, one time limit for the whole fetch and a body
// capped in bytes after decompression.
import type { ClientRequest, IncomingMessage } from "node:http";
import { pipeline, type Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import {
  assertPorts,
  assertTimeout,
  BlockedAddressError,
  checkGuardedUrl,
  openGuardedRequest,
  type GuardedRequestErrorCode,
  type GuardedRequestSeam,
} from "./guarded-request.js";
import { isPublicAddress } from "./public-address.js";

export type GuardedPageErrorCode = GuardedRequestErrorCode | "security.outbound_too_large";

export interface GuardedPage {
  /** The status of the last hop; a non-2xx page comes back too, with its body. */
  readonly status: number;
  /** The URL the body came from, after every redirect. */
  readonly finalUrl: string;
  /** The media type in lowercase without parameters (`text/html`), or `null` when the server sent none. */
  readonly contentType: string | null;
  /**
   * The declared charset label in lowercase: the `content-type` parameter, else for HTML a `<meta>` in the first
   * 1024 bytes; `null` when nothing declares one. Decode with `new TextDecoder(charset ?? "utf-8")`.
   */
  readonly charset: string | null;
  /** The body after `content-encoding` is undone, at most `maxBytes` long. */
  readonly body: Uint8Array;
  /** Whether the body went on past `maxBytes` and was cut there. */
  readonly truncated: boolean;
}

export type GuardedPageResult = Ok<GuardedPage> | Err<GuardedPageErrorCode>;

export interface GuardedPageOptions {
  /** The longest the whole fetch may take, every redirect and the body included, in milliseconds. */
  readonly timeoutMs: number;
  /** The most body bytes kept, counted after decompression. */
  readonly maxBytes: number;
  /** Redirects followed before the fetch fails; default 5, 0 returns a 3xx as the page. */
  readonly maxRedirects?: number;
  /** The `accept` header; default HTML first, anything else after it. */
  readonly accept?: string;
  /** The `user-agent` header; default {@link GUARDED_PAGE_USER_AGENT}. */
  readonly userAgent?: string;
  /** Ports the URL and every redirect may name, explicitly or through the scheme; default 80 and 443. */
  readonly allowedPorts?: readonly number[];
  /** `false` turns a body longer than `maxBytes` into `security.outbound_too_large`; default `true`. */
  readonly allowTruncation?: boolean;
}

export const GUARDED_PAGE_DEFAULT_PORTS: readonly number[] = [80, 443];
export const GUARDED_PAGE_USER_AGENT = "Mozilla/5.0 (compatible; softure-ai-security)";
const DEFAULT_ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8";
const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
/** How far into an HTML body a `<meta>` charset is looked for (the HTML spec's prescan window). */
const CHARSET_PRESCAN_BYTES = 1024;
const HTML_TYPES = new Set(["text/html", "application/xhtml+xml"]);

/** A failure inside the fetch, carried to the one place that turns it into a code. */
class PageFetchError extends Error {
  constructor(readonly code: GuardedPageErrorCode) {
    super(`fetchGuardedPage: ${code}`);
    this.name = "PageFetchError";
  }
}

/**
 * Fetches a page with GET and returns its body, capped at `maxBytes`. Every URL, the first and each redirect's
 * `Location` (resolved against the hop it came from), goes through the checks of `sendGuardedRequest`: parse,
 * scheme and credentials (`security.outbound_invalid_url`), port and IP literal (`security.outbound_blocked`), then
 * every resolved address inside the socket's lookup (`security.outbound_blocked`). More than `maxRedirects` hops is
 * `security.outbound_failed`. Past `timeoutMs` for the whole fetch it is `security.outbound_timeout`. A body over
 * `maxBytes` is cut (`truncated: true`), or `security.outbound_too_large` with `allowTruncation: false`.
 */
export async function fetchGuardedPage(
  url: string,
  options: GuardedPageOptions,
  seam: GuardedRequestSeam = {},
): Promise<GuardedPageResult> {
  const {
    timeoutMs,
    maxBytes,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    accept = DEFAULT_ACCEPT,
    userAgent = GUARDED_PAGE_USER_AGENT,
    allowedPorts = GUARDED_PAGE_DEFAULT_PORTS,
    allowTruncation = true,
  } = options;
  assertTimeout("fetchGuardedPage", timeoutMs);
  assertPorts("fetchGuardedPage", allowedPorts);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError(`fetchGuardedPage: maxBytes must be a positive whole number, got ${String(maxBytes)}`);
  }
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0) {
    throw new RangeError(`fetchGuardedPage: maxRedirects must be a whole number of 0 or more, got ${String(maxRedirects)}`);
  }
  const isAllowedAddress = seam.isAllowedAddress ?? isPublicAddress;
  const headers = { accept, "user-agent": userAgent, "accept-encoding": "gzip, deflate, br" };

  // One deadline for every hop and the body: tearing down what is open makes the pending step fail.
  let timedOut = false;
  let open: { request: ClientRequest; response?: IncomingMessage } | undefined;
  const timer = setTimeout(() => {
    timedOut = true;
    open?.response?.destroy();
    open?.request.destroy();
  }, timeoutMs);

  try {
    let checked = checkGuardedUrl(url, allowedPorts, isAllowedAddress);
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
      open = { request };
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
        checked = checkGuardedUrl(location, allowedPorts, isAllowedAddress, target);
        continue;
      }

      const { body, truncated } = await readCappedBody(response, maxBytes);
      if (truncated && !allowTruncation) {
        return err("security.outbound_too_large");
      }
      const { contentType, charset } = parseContentType(response.headers["content-type"]);
      return ok({
        status,
        finalUrl: target.toString(),
        contentType,
        charset: charset ?? (contentType !== null && HTML_TYPES.has(contentType) ? sniffMetaCharset(body) : null),
        body,
        truncated,
      });
    }
  } catch (error) {
    if (timedOut) {
      return err("security.outbound_timeout");
    }
    if (error instanceof BlockedAddressError) {
      return err("security.outbound_blocked");
    }
    if (error instanceof PageFetchError) {
      return err(error.code);
    }
    return err("security.outbound_failed");
  } finally {
    clearTimeout(timer);
    open?.response?.destroy();
    open?.request.destroy();
  }
}

function awaitResponse(request: ClientRequest): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    request.once("response", resolve);
    request.once("error", reject);
    request.end();
  });
}

/** Reads the body through its `content-encoding` and stops at `maxBytes` decoded bytes. */
async function readCappedBody(response: IncomingMessage, maxBytes: number): Promise<{ body: Uint8Array; truncated: boolean }> {
  const decoded = decode(response);
  const chunks: Buffer[] = [];
  let length = 0;
  let truncated = false;
  for await (const chunk of decoded as AsyncIterable<Buffer>) {
    if (length + chunk.length > maxBytes) {
      chunks.push(chunk.subarray(0, maxBytes - length));
      length = maxBytes;
      truncated = true;
      // Leaving the loop destroys the stream, and the pipeline the response under it.
      break;
    }
    chunks.push(chunk);
    length += chunk.length;
  }
  return { body: new Uint8Array(Buffer.concat(chunks, length)), truncated };
}

function decode(response: IncomingMessage): Readable {
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
    // An encoding the fetch did not ask for and cannot undo: the bytes would not be the page.
    throw new PageFetchError("security.outbound_failed");
  }
  if (decoder === null) {
    return response;
  }
  // The pipeline carries an error of either side to the decoder, where the read loop sees it.
  return pipeline(response, decoder, () => undefined);
}

function parseContentType(header: string | undefined): { contentType: string | null; charset: string | null } {
  if (header === undefined) {
    return { contentType: null, charset: null };
  }
  const [type = "", ...parameters] = header.split(";");
  const contentType = type.trim().toLowerCase();
  const charsetParameter = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.toLowerCase().startsWith("charset="));
  const charset = charsetParameter?.slice("charset=".length).trim().replace(/^"|"$/g, "").toLowerCase();
  return { contentType: contentType === "" ? null : contentType, charset: charset === undefined || charset === "" ? null : charset };
}

/** The charset of `<meta charset="…">` or `<meta http-equiv="content-type" content="…; charset=…">` near the start. */
function sniffMetaCharset(body: Uint8Array): string | null {
  const head = Buffer.from(body.buffer, body.byteOffset, Math.min(body.length, CHARSET_PRESCAN_BYTES)).toString("latin1");
  const match = /<meta[^>]*?charset\s*=\s*["']?\s*([\w.:+-]+)/i.exec(head);
  return match?.[1]?.toLowerCase() ?? null;
}
