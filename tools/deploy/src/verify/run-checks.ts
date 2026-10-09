import { createHash } from "node:crypto";
import { checkResponse, joinUrl, mergeHeaderChecks, needsBody, type CheckOutcome, type ObservedResponse } from "./checks.js";
import { runOriginCheck, type OriginAddress, type OriginReport } from "./origin-check.js";
import { SHA256_PATTERN, type RouteLoop, type Severity, type VerifyConfig, type VerifyRoute } from "./schema.js";
import { runTlsCheck, type TlsReport } from "./tls-check.js";

export type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Everything checked for one route, or for one entry of a route's `forEach` (whose source, when unreadable, is a row
 * of its own: `sitemap /sitemap.xml`). `status` is `null` when no response came back.
 */
export interface RouteReport {
  method: VerifyRoute["method"];
  path: string;
  url: string;
  status: number | null;
  checks: CheckOutcome[];
  passed: boolean;
  severity: Severity;
}

/** The origin row with the severity `verify.originSeverity` gives it. */
export type OriginRow = OriginReport & { severity: Severity };

/**
 * A verify run: one report per route in config order, the certificate row when `tlsMinDays` is set and the origin
 * row when an origin address is given.
 */
export interface VerifyReport {
  routes: RouteReport[];
  tls: TlsReport | null;
  origin: OriginRow | null;
}

export const DEFAULT_CONCURRENCY = 4;

const REQUEST_HEADERS = {
  "user-agent": "softure-deploy-verify",
  accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  // A CDN in front (Cloudflare) must not answer with the previous release.
  "cache-control": "no-cache",
};

/** The reason a request failed, from the error `fetch` throws: a timeout, a TLS or a connection error. */
export function describeRequestError(error: unknown, timeoutMs: number): string {
  if (error instanceof Error && error.name === "TimeoutError") return `no response within ${timeoutMs} ms`;
  const cause = error instanceof Error ? (error.cause as { code?: unknown; message?: unknown } | undefined) : undefined;
  if (typeof cause?.code === "string") return `request failed: ${cause.code}`;
  if (typeof cause?.message === "string") return `request failed: ${cause.message}`;
  return `request failed: ${error instanceof Error ? error.message : String(error)}`;
}

/** A route with the path and URL it requests: a route of the config as it is, or one entry of its `forEach`. */
interface RouteTarget {
  route: VerifyRoute;
  path: string;
  url: string;
}

/** Verify's request headers with a route's own on top (a bot's user-agent, `accept: text/markdown`). */
function getRequestHeaders(route: VerifyRoute): Record<string, string> {
  return { ...REQUEST_HEADERS, ...route.requestHeaders };
}

async function observe(options: {
  url: string;
  route: VerifyRoute;
  fetch: FetchFunction;
  timeoutMs: number;
}): Promise<ObservedResponse> {
  const { url, route, fetch, timeoutMs } = options;
  const signal = AbortSignal.timeout(timeoutMs);
  const headers = getRequestHeaders(route);
  const response = await fetch(url, { method: route.method, redirect: "manual", headers, body: route.body, signal });
  const observed = { requestUrl: url, status: response.status, getHeader: (name: string) => response.headers.get(name) };
  // The body is read only when a check needs it; otherwise it is released so the connection is not held.
  if (!needsBody(route)) {
    await response.body?.cancel();
    return { ...observed, body: null, sha256: null };
  }
  // Bytes first: the digest covers exactly what was served, a byte order mark included.
  const bytes = new Uint8Array(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { ...observed, body: new TextDecoder().decode(bytes), sha256 };
}

async function checkRoute(options: {
  baseUrl: string;
  config: VerifyConfig;
  target: RouteTarget;
  fetch: FetchFunction;
  timeoutMs: number;
}): Promise<RouteReport> {
  const { baseUrl, config, target, fetch, timeoutMs } = options;
  const { route, path, url } = target;
  const row = { method: route.method, path, url, severity: route.severity };
  let response: ObservedResponse;
  try {
    response = await observe({ url, route, fetch, timeoutMs });
  } catch (error) {
    const checks = [{ kind: "request" as const, passed: false, detail: describeRequestError(error, timeoutMs) }];
    return { ...row, status: null, checks, passed: false };
  }
  const headers = mergeHeaderChecks(config.headers, route.headers);
  const checks = checkResponse({ route, headers, response, baseUrl });
  const passed = checks.every((check) => check.passed);
  return { ...row, status: response.status, checks, passed };
}

/** One entry of a sitemap or an index: its path (and query) and, from an index, its digest. */
interface LoopEntry {
  path: string;
  sha256?: string;
}

type ReadEntries = { ok: true; entries: LoopEntry[] } | { ok: false; reason: string };

const XML_ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

/** The path and query of `text` resolved against `base`; `null` when it is not a URL. */
function getPathOf(text: string, base: string): string | null {
  try {
    const url = new URL(text, base);
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/** Every `<loc>` of a sitemap (a urlset) whose path contains `match`. */
export function readSitemapEntries(xml: string, sourceUrl: string, match: string | undefined): ReadEntries {
  const entries: LoopEntry[] = [];
  for (const [, raw = ""] of xml.matchAll(/<loc>([^<]*)<\/loc>/g)) {
    const text = raw.trim().replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity] ?? entity);
    const path = getPathOf(text, sourceUrl);
    if (path !== null && (match === undefined || path.includes(match))) entries.push({ path });
  }
  if (entries.length > 0) return { ok: true, entries };
  return { ok: false, reason: match === undefined ? "no entry" : `no entry matches ${JSON.stringify(match)}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every entry of a JSON index: its `url` key as a path and, unless `digest` is null, its digest. */
export function readIndexEntries(text: string, sourceUrl: string, keys: Extract<RouteLoop, { index: string }>): ReadEntries {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not JSON" };
  }
  const items = isRecord(document) ? document[keys.items] : undefined;
  if (!Array.isArray(items)) return { ok: false, reason: `no ${JSON.stringify(keys.items)} list` };
  const entries: LoopEntry[] = [];
  for (const [index, item] of items.entries()) {
    const url = isRecord(item) ? item[keys.url] : undefined;
    const path = typeof url === "string" ? getPathOf(url, sourceUrl) : null;
    if (path === null) return { ok: false, reason: `entry ${index} has no url text` };
    if (keys.digest === null) {
      entries.push({ path });
      continue;
    }
    const digest = isRecord(item) ? item[keys.digest] : undefined;
    if (typeof digest !== "string") return { ok: false, reason: `entry ${index} has no digest text` };
    if (!SHA256_PATTERN.test(digest)) return { ok: false, reason: `entry ${index} digest ${JSON.stringify(digest)} is not sha256:<hex>` };
    entries.push({ path, sha256: digest });
  }
  return entries.length > 0 ? { ok: true, entries } : { ok: false, reason: "no entry" };
}

/**
 * The targets of a route: the route itself, or one per entry of its `forEach` source, requested on the verified URL's
 * origin (a sitemap names the production host). An unreadable source is one failed row naming it.
 */
async function expandRoute(options: {
  baseUrl: string;
  route: VerifyRoute;
  fetch: FetchFunction;
  timeoutMs: number;
}): Promise<RouteTarget[] | RouteReport> {
  const { baseUrl, route, fetch, timeoutMs } = options;
  const loop = route.forEach;
  if (loop === undefined) {
    // The schema gives a route without forEach a path.
    const path = route.path ?? "/";
    return [{ route, path, url: joinUrl(baseUrl, path) }];
  }
  const sourcePath = "sitemap" in loop ? loop.sitemap : loop.index;
  const label = `${"sitemap" in loop ? "sitemap" : "index"} ${sourcePath}`;
  const url = joinUrl(baseUrl, sourcePath);
  const fail = (status: number | null, reason: string): RouteReport => ({
    method: "GET",
    path: label,
    url,
    status,
    checks: [{ kind: "source", passed: false, detail: `${label}: ${reason}` }],
    passed: false,
    severity: route.severity,
  });
  let status: number;
  let text: string;
  try {
    const response = await fetch(url, { method: "GET", redirect: "manual", headers: getRequestHeaders(route), signal: AbortSignal.timeout(timeoutMs) });
    status = response.status;
    text = await response.text();
  } catch (error) {
    return fail(null, describeRequestError(error, timeoutMs));
  }
  if (status !== 200) return fail(status, `status ${status}, expected 200`);
  const read = "sitemap" in loop ? readSitemapEntries(text, url, loop.match) : readIndexEntries(text, url, loop);
  if (!read.ok) return fail(status, read.reason);
  const origin = new URL(baseUrl).origin;
  return read.entries.map((entry) => ({
    route: entry.sha256 === undefined ? route : { ...route, sha256: entry.sha256 },
    path: entry.path,
    url: `${origin}${entry.path}`,
  }));
}

/** Runs `task` over `items` with at most `limit` at once; results keep the order of `items`. */
async function mapWithLimit<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      // `index` is below `items.length`, checked by the loop condition.
      results[index] = await task(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

/**
 * Requests every route of `config` from `baseUrl` (redirects not followed; a `forEach` route once per entry of its
 * sitemap or index) and checks each response; with
 * `tlsMinDays`, reads the certificate once alongside; with `origin`, tries one direct connection to the server behind
 * the CDN. A network error, a TLS error or a timeout is a failed check, never a thrown error.
 */
export async function runVerify(options: {
  baseUrl: string;
  config: VerifyConfig;
  origin?: OriginAddress;
  fetch?: FetchFunction;
  concurrency?: number;
  timeoutMs?: number;
}): Promise<VerifyReport> {
  const { baseUrl, config } = options;
  const fetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const minDays = config.tlsMinDays;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const { origin } = options;
  const checkRoutes = async (): Promise<RouteReport[]> => {
    const expanded = await mapWithLimit(config.routes, concurrency, (route) => expandRoute({ baseUrl, route, fetch, timeoutMs }));
    const work = expanded.flatMap((item): (RouteTarget | RouteReport)[] => (Array.isArray(item) ? item : [item]));
    return mapWithLimit(work, concurrency, (item) =>
      "checks" in item ? Promise.resolve(item) : checkRoute({ baseUrl, config, target: item, fetch, timeoutMs }),
    );
  };
  const [routes, tls, originReport] = await Promise.all([
    checkRoutes(),
    minDays === undefined ? null : runTlsCheck({ baseUrl, minDays, timeoutMs }),
    origin === undefined
      ? null
      : runOriginCheck({ address: origin, timeoutMs }).then((report): OriginRow => ({ ...report, severity: config.originSeverity })),
  ]);
  return { routes, tls, origin: originReport };
}
