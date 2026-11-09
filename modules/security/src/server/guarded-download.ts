// A GET of a file at a URL someone else chose (a video, an image, a document a user links to), with the SSRF guard
// of `sendGuardedRequest` on every redirect hop and one time limit for the whole download. Unlike the page fetch, the
// body is never held in memory: it streams to the caller's `consume` (storage, a hash, a disk file) one chunk at a
// time, capped in bytes after decompression.
import type { IncomingMessage } from "node:http";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { decodeBody, followGuardedRedirects, GuardedFetchError, parseContentType, type OpenHop } from "./guarded-get.js";
import { GUARDED_PAGE_DEFAULT_PORTS, GUARDED_PAGE_USER_AGENT, type GuardedPageErrorCode } from "./guarded-page.js";
import { assertPorts, assertTimeout, BlockedAddressError, type GuardedRequestSeam } from "./guarded-request.js";
import { isPublicAddress } from "./public-address.js";

export type GuardedDownloadErrorCode = GuardedPageErrorCode;

/** What is known of the file before its body: the last hop's status and headers. */
export interface GuardedDownloadHead {
  /** The status of the last hop. */
  readonly status: number;
  /** The URL the body comes from, after every redirect. */
  readonly finalUrl: string;
  /** The media type in lowercase without parameters (`video/mp4`), or `null` when the server sent none. */
  readonly contentType: string | null;
  /** The declared `content-length` of the body as sent (before decompression), or `null` when absent. */
  readonly contentLength: number | null;
}

/** The body handed to `consume`: decoded chunks, ending with an error past `maxBytes`, the time limit or a reset. */
export interface GuardedDownloadBody extends GuardedDownloadHead {
  readonly body: AsyncIterable<Buffer>;
}

/**
 * A finished download: `consumed: true` with what `consume` returned for a 2xx answer, or `consumed: false` for any
 * other status (a 404, a 403), whose body is not read.
 */
export type GuardedDownload<T> = GuardedDownloadHead & ({ readonly consumed: true; readonly value: T } | { readonly consumed: false });

export type GuardedDownloadResult<T> = Ok<GuardedDownload<T>> | Err<GuardedDownloadErrorCode>;

export interface GuardedDownloadOptions {
  /** The longest the whole download may take, every redirect and the body included, in milliseconds. */
  readonly timeoutMs: number;
  /** The most body bytes allowed, counted after decompression; one more is `security.outbound_too_large`. */
  readonly maxBytes: number;
  /** Redirects followed before the download fails; default 5. */
  readonly maxRedirects?: number;
  /** The `accept` header; default anything. */
  readonly accept?: string;
  /** The `user-agent` header; default {@link GUARDED_PAGE_USER_AGENT}. */
  readonly userAgent?: string;
  /** Ports the URL and every redirect may name, explicitly or through the scheme; default 80 and 443. */
  readonly allowedPorts?: readonly number[];
  /** `true` refuses a URL or a redirect that is not `https:` (`security.outbound_invalid_url`); default `false`. */
  readonly requireHttps?: boolean;
}

const DEFAULT_ACCEPT = "*/*";
const DEFAULT_MAX_REDIRECTS = 5;

/**
 * Downloads a file with GET and streams its body to `consume`, which runs only for a 2xx answer. The URL and every
 * redirect pass the checks of `fetchGuardedPage` (`security.outbound_invalid_url`, `security.outbound_blocked`, more
 * than `maxRedirects` hops `security.outbound_failed`), and `requireHttps` refuses a hop that is not `https:`. A
 * declared `content-length` over `maxBytes` is refused before `consume` runs; a body that passes `maxBytes` while it
 * streams makes the iteration throw, and the download is `security.outbound_too_large`. Past `timeoutMs` for the whole
 * download, `consume` included, it is `security.outbound_timeout`; a reset or a body that does not decode,
 * `security.outbound_failed`. An error `consume` throws itself (not one of the body's) propagates: a storage failure is
 * the caller's to handle. `consume` must read the body to its end or throw; whatever it leaves unread is discarded.
 */
export async function downloadGuardedFile<T>(
  url: string,
  options: GuardedDownloadOptions,
  consume: (file: GuardedDownloadBody) => Promise<T>,
  seam: GuardedRequestSeam = {},
): Promise<GuardedDownloadResult<T>> {
  const {
    timeoutMs,
    maxBytes,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    accept = DEFAULT_ACCEPT,
    userAgent = GUARDED_PAGE_USER_AGENT,
    allowedPorts = GUARDED_PAGE_DEFAULT_PORTS,
    requireHttps = false,
  } = options;
  assertTimeout("downloadGuardedFile", timeoutMs);
  assertPorts("downloadGuardedFile", allowedPorts);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError(`downloadGuardedFile: maxBytes must be a positive whole number, got ${String(maxBytes)}`);
  }
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0) {
    throw new RangeError(`downloadGuardedFile: maxRedirects must be a whole number of 0 or more, got ${String(maxRedirects)}`);
  }
  const isAllowedAddress = seam.isAllowedAddress ?? isPublicAddress;
  const headers = { accept, "user-agent": userAgent, "accept-encoding": "gzip, deflate, br" };

  // One deadline for every hop and the body: tearing down what is open makes the pending step fail.
  let timedOut = false;
  const hops: OpenHop[] = [];
  const tearDown = (): void => {
    for (const hop of hops) {
      hop.response?.destroy();
      hop.request.destroy();
    }
  };
  const timer = setTimeout(() => {
    timedOut = true;
    tearDown();
  }, timeoutMs);

  try {
    const reached = await followGuardedRedirects(url, { headers, allowedPorts, maxRedirects, isAllowedAddress, requireHttps }, seam, (hop) => {
      hops.push(hop);
    });
    if (!reached.ok) {
      return reached;
    }
    const { target, response, status } = reached.value;
    const head: GuardedDownloadHead = {
      status,
      finalUrl: target.toString(),
      contentType: parseContentType(response.headers["content-type"]).contentType,
      contentLength: parseContentLength(response.headers["content-length"]),
    };
    if (status < 200 || status > 299) {
      return ok({ ...head, consumed: false });
    }
    if (head.contentLength !== null && head.contentLength > maxBytes && response.headers["content-encoding"] === undefined) {
      return err("security.outbound_too_large");
    }
    const value = await consume({ ...head, body: readCappedChunks(response, maxBytes) });
    return ok({ ...head, consumed: true, value });
  } catch (error) {
    if (timedOut) {
      return err("security.outbound_timeout");
    }
    if (error instanceof BlockedAddressError) {
      return err("security.outbound_blocked");
    }
    if (error instanceof GuardedFetchError) {
      return err(error.code);
    }
    if (error instanceof BodyStreamError) {
      return err("security.outbound_failed");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    tearDown();
  }
}

/** A network or decoding failure while the body streamed, told apart from an error of the caller's `consume`. */
class BodyStreamError extends Error {
  constructor(cause: unknown) {
    super("downloadGuardedFile: the body stream failed", { cause });
    this.name = "BodyStreamError";
  }
}

/** The decoded body, chunk by chunk; one byte past `maxBytes` throws `security.outbound_too_large`. */
async function* readCappedChunks(response: IncomingMessage, maxBytes: number): AsyncGenerator<Buffer> {
  const decoded = decodeBody(response);
  let length = 0;
  const chunks = (decoded as AsyncIterable<Buffer>)[Symbol.asyncIterator]();
  for (;;) {
    let next: IteratorResult<Buffer>;
    try {
      next = await chunks.next();
    } catch (error) {
      throw new BodyStreamError(error);
    }
    if (next.done === true) {
      return;
    }
    length += next.value.length;
    if (length > maxBytes) {
      decoded.destroy();
      throw new GuardedFetchError("security.outbound_too_large");
    }
    yield next.value;
  }
}

/** Node's parser has already refused a `content-length` that is not a number. */
function parseContentLength(header: string | undefined): number | null {
  return header === undefined ? null : Number(header);
}
