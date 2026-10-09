// The origins one request is served under. An app may answer on two hosts: the apex (marketing, docs and every
// discovery document, where scanners look) and the app host (the MCP endpoint, OAuth and the consent screen).
// Pure: no config, no environment. Reading the request is core's rule (`readRequestOrigin`, issue #311).
import { readRequestHost, readRequestOrigin, type OriginRequest } from "@softure-ai/core";

export { readRequestHost, readRequestOrigin, readServedOrigin };

/** What the origin helpers read from a request: a Web `Request`, or anything with a URL and headers. */
export type { OriginRequest };

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

/**
 * The origin the request was sent to (core `readRequestOrigin`: `X-Forwarded-Proto` when http(s), `Host`); throws by
 * name when `Host` is no host, so a document is never built on it.
 */
function readServedOrigin(request: OriginRequest): string {
  const origin = readRequestOrigin(request);
  if (origin === null) throw new Error(`@softure-ai/agent-ready: the request's host "${readRequestHost(request).slice(0, 100)}" is not a host`);
  return origin;
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
  const requestOrigin = readServedOrigin(request);
  const appOrigin = toOrigin(settings.appOrigin) ?? requestOrigin;
  const apexOrigin = toOrigin(settings.apexOrigin) ?? appOrigin;
  return { appOrigin, apexOrigin, requestOrigin };
}

/** Origins for a builder called outside a request (a CLI, a test): the request origin is the app origin. */
export function createOrigins(appOrigin: string, apexOrigin: string = appOrigin): AgentOrigins {
  const app = new URL(trimOrigin(appOrigin)).origin;
  return { appOrigin: app, apexOrigin: new URL(trimOrigin(apexOrigin)).origin, requestOrigin: app };
}
