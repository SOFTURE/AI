// The route guard for the app's `proxy.ts` (roadmap ID-3, unknown 1). It uses only Web `Request`
// and `Response`, imports nothing from Next and no React, so it chains with other proxy pieces:
// `return channels.carry(request, guard(request)) ?? channels.tag(request) ?? NextResponse.next()`
// (the channel piece of @softure-ai/analytics/proxy).
//
// It checks that the session cookie is present, nothing more: an optimistic check that keeps
// anonymous visitors off private pages without a database round trip in the proxy. Pages and
// actions still call `requireUser`, which reads the session row.
import type { SoftureConfig } from "@softure-ai/core";
import { getAuthRoutes } from "../server/options.js";
import { getSessionCookie, readSessionToken } from "../session-cookie.js";

export interface AuthGuardOptions {
  /** Path prefixes that need a session; each matches whole segments (`/account` → `/account/…`). */
  readonly protect: readonly string[];
}

export type AuthGuard = (request: Request) => Response | null;

/** A guard that redirects to the login page (with `?next=`) for protected paths without a session cookie. */
export function createAuthGuard(config: SoftureConfig, options: AuthGuardOptions): AuthGuard {
  const routes = getAuthRoutes(config);
  const cookieName = getSessionCookie(config).name;
  const prefixes = [...options.protect, routes.changePassword].map(normalizePrefix);

  return (request) => {
    const url = new URL(request.url);
    // Compared decoded and lowercased, so `/%61ccount` or `/ACCOUNT` (which a case-insensitive
    // front proxy may route to /account) is guarded too. Undecodable paths are guarded.
    const path = decodePath(url.pathname);
    if (path !== null && !prefixes.some((prefix) => isUnder(path, prefix))) return null;
    if (readSessionToken(request.headers.get("cookie"), cookieName) !== null) return null;
    // Built on appOrigin: behind a proxy the request URL may carry an internal host.
    const login = new URL(routes.login, config.appOrigin);
    login.searchParams.set("next", `${url.pathname}${url.search}`);
    return Response.redirect(login, 307);
  };
}

function normalizePrefix(prefix: string): string {
  if (!prefix.startsWith("/")) {
    throw new Error(`createAuthGuard: protected path "${prefix}" must start with /`);
  }
  const trimmed = prefix.length > 1 && prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return trimmed.toLowerCase();
}

function decodePath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname).toLowerCase();
  } catch {
    return null;
  }
}

function isUnder(pathname: string, prefix: string): boolean {
  return prefix === "/" || pathname === prefix || pathname.startsWith(`${prefix}/`);
}
