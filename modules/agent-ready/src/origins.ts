// The origins one request is served under. An app may answer on two hosts: the apex (marketing, docs and every
// discovery document, where scanners look) and the app host (the MCP endpoint, OAuth and the consent screen).
// Pure: no config, no environment.

/** What the origin helpers read from a request: a Web `Request`, or anything with a URL and headers. */
export interface OriginRequest {
  readonly url: string;
  readonly headers: { get(name: string): string | null };
}

export interface AgentOrigins {
  /** The host of the MCP endpoint and of every OAuth URL. */
  readonly appOrigin: string;
  /** The host of documentation, cards and catalogs. */
  readonly apexOrigin: string;
  /** The origin the request was sent to: a root document's own identity (root PRM `resource`, directory `@authority`). */
  readonly requestOrigin: string;
}

export interface OriginSettings {
  /** The app host; without it, the request's origin. */
  readonly appOrigin?: string | undefined;
  /** The apex host; without it, the app origin. */
  readonly apexOrigin?: string | undefined;
}

/** An origin without the trailing slashes a configured value may carry, so `${origin}/path` never has `//`. */
export function trimOrigin(origin: string): string {
  let end = origin.length;
  while (end > 0 && origin[end - 1] === "/") end -= 1;
  return origin.slice(0, end);
}

function readFirstValue(header: string | null): string | null {
  const value = header?.split(",")[0]?.trim().toLowerCase();
  return value === undefined || value === "" ? null : value;
}

/** The host the request was sent to: `Host`, else the URL's host. */
export function readRequestHost(request: OriginRequest): string {
  return readFirstValue(request.headers.get("host")) ?? new URL(request.url).host;
}

/**
 * The origin the request was sent to: the first `X-Forwarded-Proto` value when it is http or https (else the URL's
 * scheme) and `Host` (else the URL's host). Never `request.url` alone: a standalone Next server reports its listening
 * address there (`http://0.0.0.0:3000`).
 */
export function readRequestOrigin(request: OriginRequest): string {
  const url = new URL(request.url);
  const proto = readFirstValue(request.headers.get("x-forwarded-proto"));
  const scheme = proto === "http" || proto === "https" ? proto : url.protocol.replace(/:$/, "");
  return new URL(`${scheme}://${readRequestHost(request)}`).origin;
}

function toOrigin(value: string | undefined): string | null {
  if (value === undefined || value.trim() === "") return null;
  return new URL(trimOrigin(value.trim())).origin;
}

/**
 * The origins for `request`: `appOrigin` is the configured value, else the request's origin; `apexOrigin` is the
 * configured value, else `appOrigin`. Every value is a bare origin.
 */
export function resolveOrigins(request: OriginRequest, settings: OriginSettings = {}): AgentOrigins {
  const requestOrigin = readRequestOrigin(request);
  const appOrigin = toOrigin(settings.appOrigin) ?? requestOrigin;
  const apexOrigin = toOrigin(settings.apexOrigin) ?? appOrigin;
  return { appOrigin, apexOrigin, requestOrigin };
}

/** Origins for a builder called outside a request (a CLI, a test): the request origin is the app origin. */
export function createOrigins(appOrigin: string, apexOrigin: string = appOrigin): AgentOrigins {
  const app = new URL(trimOrigin(appOrigin)).origin;
  return { appOrigin: app, apexOrigin: new URL(trimOrigin(apexOrigin)).origin, requestOrigin: app };
}
