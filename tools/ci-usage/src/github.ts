// A small GitHub REST client on the built-in fetch: JSON GETs, Link pagination and a request budget read from the
// rate-limit headers, so a busy repository ends in a partial report instead of a failed or sleeping job.

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<Response>;

export interface GithubClientOptions {
  token: string;
  fetch?: FetchLike;
  baseUrl?: string;
  /** Requests kept in reserve: the client stops reading when `x-ratelimit-remaining` reaches it. */
  reserve?: number;
}

export type GithubResult<T> =
  | { ok: true; data: T; next: string | null }
  | { ok: false; kind: "budget"; message: string }
  | { ok: false; kind: "http"; status: number; message: string };

export interface GithubClient {
  get: (pathOrUrl: string, query?: Record<string, string>) => Promise<GithubResult<unknown>>;
  /** A JSON POST or PATCH; writes ignore the reserve (they are few and the report depends on them). */
  send: (method: "POST" | "PATCH", path: string, body: unknown) => Promise<GithubResult<unknown>>;
  /** Requests sent so far. */
  getRequestCount: () => number;
  /** The last `x-ratelimit-remaining` seen, or null before the first answer. */
  getRemaining: () => number | null;
}

export const DEFAULT_BASE_URL = "https://api.github.com";
export const DEFAULT_RESERVE = 50;
const API_VERSION = "2022-11-28";

/** The `rel="next"` address of a Link header, or null. */
export function getNextLink(header: string | null): string | null {
  if (header === null) return null;
  // Plain string parsing: the header comes from the network, so no backtracking pattern runs over it.
  for (const part of header.split(",")) {
    const [target, ...params] = part.split(";").map((piece) => piece.trim());
    if (target === undefined || !target.startsWith("<") || !target.endsWith(">")) continue;
    if (params.some((param) => param.replace(/ /g, "") === 'rel="next"')) return target.slice(1, -1);
  }
  return null;
}

function buildUrl(baseUrl: string, pathOrUrl: string, query: Record<string, string> | undefined): string {
  const url = new URL(pathOrUrl.startsWith("https://") ? pathOrUrl : `${baseUrl}${pathOrUrl}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : response.statusText;
  } catch {
    return response.statusText;
  }
}

export function createGithubClient(options: GithubClientOptions): GithubClient {
  const fetchJson = options.fetch ?? ((url, init) => fetch(url, init));
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const reserve = options.reserve ?? DEFAULT_RESERVE;
  let requests = 0;
  let remaining: number | null = null;

  async function request(method: "GET" | "POST" | "PATCH", url: string, body: unknown): Promise<GithubResult<unknown>> {
    // The path, never the token, names the request in every message.
    const name = `${method} ${new URL(url).pathname}`;
    if (method === "GET" && remaining !== null && remaining <= reserve) {
      return { ok: false, kind: "budget", message: `${name}: the rate limit is down to ${String(remaining)} requests (reserve ${String(reserve)})` };
    }
    requests += 1;
    let response: Response;
    try {
      response = await fetchJson(url, {
        method,
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${options.token}`,
          "x-github-api-version": API_VERSION,
          "user-agent": "softure-ci-usage",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      return { ok: false, kind: "http", status: 0, message: `${name} failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    const header = response.headers.get("x-ratelimit-remaining");
    if (header !== null && Number.isFinite(Number(header))) remaining = Number(header);
    if (!response.ok) {
      const message = await readMessage(response);
      const limited = (response.status === 403 || response.status === 429) && (remaining === 0 || response.headers.has("retry-after"));
      if (limited) return { ok: false, kind: "budget", message: `${name}: rate limited (${message})` };
      return { ok: false, kind: "http", status: response.status, message: `${name} answered ${String(response.status)}: ${message}` };
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return { ok: false, kind: "http", status: response.status, message: `${name} answered with a body that is not JSON` };
    }
    return { ok: true, data, next: getNextLink(response.headers.get("link")) };
  }

  return {
    get: (pathOrUrl, query) => request("GET", buildUrl(baseUrl, pathOrUrl, query), undefined),
    send: (method, path, body) => request(method, buildUrl(baseUrl, path, undefined), body),
    getRequestCount: () => requests,
    getRemaining: () => remaining,
  };
}
