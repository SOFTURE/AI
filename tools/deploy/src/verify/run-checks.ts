import { checkResponse, joinUrl, mergeHeaderChecks, needsBody, type CheckOutcome, type ObservedResponse } from "./checks.js";
import type { VerifyConfig, VerifyRoute } from "./schema.js";
import { runTlsCheck, type TlsReport } from "./tls-check.js";

export type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

/** Everything checked for one route. `status` is `null` when no response came back. */
export interface RouteReport {
  method: VerifyRoute["method"];
  path: string;
  url: string;
  status: number | null;
  checks: CheckOutcome[];
  passed: boolean;
}

/** A verify run: one report per route in config order, and the certificate row when `tlsMinDays` is set. */
export interface VerifyReport {
  routes: RouteReport[];
  tls: TlsReport | null;
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

async function observe(options: {
  url: string;
  route: VerifyRoute;
  fetch: FetchFunction;
  timeoutMs: number;
}): Promise<ObservedResponse> {
  const { url, route, fetch, timeoutMs } = options;
  const signal = AbortSignal.timeout(timeoutMs);
  // A route's own request headers go on top of verify's defaults (a bot's user-agent, `accept: text/markdown`).
  const headers = { ...REQUEST_HEADERS, ...route.requestHeaders };
  const response = await fetch(url, { method: route.method, redirect: "manual", headers, body: route.body, signal });
  // The body is read only when a marker needs it; otherwise it is released so the connection is not held.
  const body = needsBody(route) ? await response.text() : null;
  if (body === null) await response.body?.cancel();
  return { requestUrl: url, status: response.status, getHeader: (name) => response.headers.get(name), body };
}

async function checkRoute(options: {
  baseUrl: string;
  config: VerifyConfig;
  route: VerifyRoute;
  fetch: FetchFunction;
  timeoutMs: number;
}): Promise<RouteReport> {
  const { baseUrl, config, route, fetch, timeoutMs } = options;
  const url = joinUrl(baseUrl, route.path);
  let response: ObservedResponse;
  try {
    response = await observe({ url, route, fetch, timeoutMs });
  } catch (error) {
    const checks = [{ kind: "request" as const, passed: false, detail: describeRequestError(error, timeoutMs) }];
    return { method: route.method, path: route.path, url, status: null, checks, passed: false };
  }
  const headers = mergeHeaderChecks(config.headers, route.headers);
  const checks = checkResponse({ route, headers, response, baseUrl });
  const passed = checks.every((check) => check.passed);
  return { method: route.method, path: route.path, url, status: response.status, checks, passed };
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
 * Requests every route of `config` from `baseUrl` (redirects not followed) and checks each response; with
 * `tlsMinDays`, reads the certificate once alongside. A network error, a TLS error or a timeout is a failed check,
 * never a thrown error.
 */
export async function runVerify(options: {
  baseUrl: string;
  config: VerifyConfig;
  fetch?: FetchFunction;
  concurrency?: number;
  timeoutMs?: number;
}): Promise<VerifyReport> {
  const { baseUrl, config } = options;
  const fetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const minDays = config.tlsMinDays;
  const [routes, tls] = await Promise.all([
    mapWithLimit(config.routes, options.concurrency ?? DEFAULT_CONCURRENCY, (route) =>
      checkRoute({ baseUrl, config, route, fetch, timeoutMs }),
    ),
    minDays === undefined ? null : runTlsCheck({ baseUrl, minDays, timeoutMs }),
  ]);
  return { routes, tls };
}
