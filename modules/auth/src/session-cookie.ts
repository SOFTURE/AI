// The session cookie (roadmap ID-3, unknown 2). A secure cookie gets the prefix browsers enforce:
// `__Host-` when it is host-only (no Domain, Path=/), `__Secure-` when it is shared with subdomains
// through `cookie.domain`. On plain HTTP (local development) it keeps the bare name, because
// browsers refuse prefixed cookies without Secure.
import type { SoftureConfig } from "@softure-ai/core";
import { getAuthOptions } from "./server/options.js";

const DAY_SECONDS = 24 * 60 * 60;

export interface SessionCookie {
  readonly name: string;
  readonly domain: string | undefined;
  readonly secure: boolean;
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAgeSeconds: number;
}

export function getSessionCookie(config: SoftureConfig): SessionCookie {
  const options = getAuthOptions(config);
  const secure = options.cookie.secure ?? config.appOrigin.startsWith("https:");
  const domain = options.cookie.domain;
  const prefix = !secure ? "" : domain === undefined ? "__Host-" : "__Secure-";
  return {
    name: `${prefix}${options.cookie.name}`,
    domain,
    secure,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAgeSeconds: options.session.ttlDays * DAY_SECONDS,
  };
}

/** The session token in a `Cookie` header, or null. */
export function readSessionToken(cookieHeader: string | null, cookieName: string): string | null {
  if (cookieHeader === null) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator !== -1 && part.slice(0, separator).trim() === cookieName) {
      const value = part.slice(separator + 1).trim();
      return value === "" ? null : value;
    }
  }
  return null;
}
