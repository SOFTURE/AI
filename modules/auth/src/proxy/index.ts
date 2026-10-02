// The route guard for the app's `proxy.ts` (roadmap ID-3, unknown 1). It uses only Web `Request`
// and `Response`, imports nothing from Next and no React, so it chains with other proxy pieces:
// `return guard(request) ?? tagChannel(request) ?? NextResponse.next()`.
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
    if (!prefixes.some((prefix) => isUnder(url.pathname, prefix))) return null;
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
  return prefix.length > 1 && prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

function isUnder(pathname: string, prefix: string): boolean {
  return prefix === "/" || pathname === prefix || pathname.startsWith(`${prefix}/`);
}
