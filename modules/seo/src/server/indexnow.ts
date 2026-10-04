// IndexNow: tells Bing, Yandex, Seznam, Naver and the other participants that a URL changed, instead
// of waiting for a crawl. One JSON POST to the shared endpoint, which forwards it to every engine.
//
// The key is public by protocol: an engine verifies the host by reading the key file at
// `keyLocation`. A key file covers only URLs under its own directory, so the module serves it at
// the site root and every submit names its location.
import { INDEXNOW_KEY_PATTERN } from "../options.js";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** The protocol's ceiling for one POST. */
export const INDEXNOW_MAX_URLS = 10_000;

const DEFAULT_TIMEOUT_MS = 10_000;

export interface IndexNowRequestBody {
  readonly host: string;
  readonly key: string;
  readonly keyLocation: string;
  readonly urlList: readonly string[];
}

export type IndexNowFailure =
  | "seo.indexnow_invalid_key"
  | "seo.indexnow_too_many_urls"
  | "seo.indexnow_foreign_url"
  | "seo.indexnow_rejected"
  | "seo.indexnow_unreachable";

export type IndexNowResult =
  /** Nothing to submit; no request was made. */
  | { readonly kind: "skipped" }
  /** `commit` was not set: the request that would have been sent, and no request. */
  | { readonly kind: "dry_run"; readonly endpoint: string; readonly body: IndexNowRequestBody }
  /** The endpoint accepted the list (200, or 202 while it validates the key). */
  | { readonly kind: "submitted"; readonly status: number; readonly count: number }
  | { readonly kind: "failed"; readonly code: IndexNowFailure; readonly reason: string };

export interface SubmitToIndexNowOptions {
  /** The IndexNow key, as served by the key file. */
  readonly key: string;
  /** The site origin (`getSeoSettings().siteOrigin`): the host of every URL. */
  readonly siteOrigin: string;
  /** The key file's path on the site (`getSeoSettings().routes.indexNowKey`). */
  readonly keyPath: string;
  /** Sends the request only when `true`; otherwise returns the request as a dry run. */
  readonly commit?: boolean;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly endpoint?: string;
}

/**
 * Submits changed URLs (paths on the site or absolute URLs on its host) in one request. A dry run
 * unless `commit: true`. Every failure is a value, never a throw: a submit is an extra after a
 * publish and must never stop it.
 */
export async function submitToIndexNow(urls: readonly string[], options: SubmitToIndexNowOptions): Promise<IndexNowResult> {
  if (!INDEXNOW_KEY_PATTERN.test(options.key)) {
    return failed("seo.indexnow_invalid_key", "the IndexNow key must be 8 to 128 letters, digits or dashes");
  }
  if (urls.length === 0) {
    return { kind: "skipped" };
  }
  if (urls.length > INDEXNOW_MAX_URLS) {
    return failed("seo.indexnow_too_many_urls", `IndexNow takes at most ${String(INDEXNOW_MAX_URLS)} URLs per request, got ${String(urls.length)}`);
  }

  const site = new URL(options.siteOrigin);
  const urlList: string[] = [];
  for (const candidate of urls) {
    const url = toSiteUrl(candidate, site);
    if (url === null) {
      return failed("seo.indexnow_foreign_url", `"${candidate}" is not a URL on ${site.host}`);
    }
    urlList.push(url);
  }
  const body: IndexNowRequestBody = {
    host: site.host,
    key: options.key,
    keyLocation: new URL(options.keyPath, site).toString(),
    urlList,
  };
  const endpoint = options.endpoint ?? INDEXNOW_ENDPOINT;
  if (options.commit !== true) {
    return { kind: "dry_run", endpoint, body };
  }
  return send(endpoint, body, options);
}

async function send(endpoint: string, body: IndexNowRequestBody, options: SubmitToIndexNowOptions): Promise<IndexNowResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (response.status === 200 || response.status === 202) {
      return { kind: "submitted", status: response.status, count: body.urlList.length };
    }
    return failed("seo.indexnow_rejected", `IndexNow answered ${String(response.status)} for ${String(body.urlList.length)} URLs`);
  } catch (error) {
    return failed("seo.indexnow_unreachable", `IndexNow could not be reached: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function toSiteUrl(candidate: string, site: URL): string | null {
  if (candidate.startsWith("//")) {
    return null;
  }
  try {
    const url = new URL(candidate, site);
    return url.origin === site.origin ? url.toString() : null;
  } catch {
    return null;
  }
}

function failed(code: IndexNowFailure, reason: string): IndexNowResult {
  return { kind: "failed", code, reason };
}
