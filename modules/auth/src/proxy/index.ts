// The route guard for the app's `proxy.ts` (roadmap ID-3, unknown 1). It uses only Web `Request`
// and `Response`, imports nothing from Next and no React, so it chains with other proxy pieces:
// `return channels.carry(request, guard(request)) ?? channels.tag(request) ?? NextResponse.next()`
// (the channel piece of @softure-ai/analytics/proxy).
//
// It checks that the session cookie is present, nothing more: an optimistic check that keeps
// anonymous visitors off private pages without a database round trip in the proxy. Pages and
// actions still call `requireUser`, which reads the session row. An app that is private by default
// protects "/" and lists its public paths in `exclude`; auth's own public pages are never guarded.
import { parseOrigin, resolveAppOrigin, type SoftureConfig } from "@softure-ai/core";
import { getAuthOptions, getAuthRoutes } from "../server/options.js";
import { getSessionCookie, readSessionToken } from "../session-cookie.js";

export interface AuthGuardOptions {
  /** Path prefixes that need a session; each matches whole segments (`/account` → `/account/…`). */
  readonly protect: readonly string[];
  /**
   * Path prefixes that never need one, checked before `protect` (e.g. `protect: ["/"]` with the
   * public pages here). `"/"` here is the home page only. The change-password route stays guarded.
   */
  readonly exclude?: readonly string[];
  /**
   * Paths that never need a session, matched whole (`/pricing` and `/pricing/`, not `/pricing/plans`), for an app
   * that protects everything except an exact allowlist. Compared decoded and lowercased, like the other lists.
   */
  readonly excludeExact?: readonly string[];
  /**
   * Origins besides `appOrigin` and the config's `origins.trustedOrigins` that the login redirect may stay on
   * (`https://example.com`). Prefer the config's block, which every module reads. The request's public origin
   * (core `resolveAppOrigin`: `X-Forwarded-Host`, else `Host`) is used only when it is listed; any other goes to
   * `appOrigin`.
   */
  readonly trustedOrigins?: readonly string[];
  /**
   * `"absolute"` (default): the login URL is built on the resolved origin (above). `"relative"`: the `Location` is
   * the path only (`/login?next=…`), so the browser stays on whatever host and port it used; for a stack served on
   * ports or hosts the config cannot list (an integration run on a random port).
   */
  readonly redirect?: "absolute" | "relative";
}

/** Mounted at a fixed path by the module (manifest `mount`); it answers `{ user: null }` without a session. */
const SESSION_ROUTE = "/api/auth/session";

export type AuthGuard = (request: Request) => Response | null;

/** A guard that redirects to the login page (with `?next=`) for protected paths without a session cookie. */
export function createAuthGuard(config: SoftureConfig, options: AuthGuardOptions): AuthGuard {
  const routes = getAuthRoutes(config);
  const cookieNames = [getSessionCookie(config).name, getAuthOptions(config).legacySession?.cookieName].filter((name) => name !== undefined);
  const prefixes = options.protect.map((prefix) => normalizePrefix(prefix, "protected"));
  const changePassword = normalizePrefix(routes.changePassword, "protected");
  // Auth's own public pages: guarding them would send a visitor from the login page to itself.
  const publicPaths = [routes.login, routes.register, routes.forgotPassword, routes.resetPassword, SESSION_ROUTE].map((path) =>
    normalizePrefix(path, "excluded"),
  );
  const excluded = (options.exclude ?? []).map((prefix) => normalizePrefix(prefix, "excluded"));
  const exactExcluded = new Set((options.excludeExact ?? []).map((path) => normalizePrefix(path, "excluded")));
  const trustedOrigins = (options.trustedOrigins ?? []).map(normalizeOrigin);

  const isGuarded = (path: string): boolean => {
    if (isUnder(path, changePassword)) return true;
    if (exactExcluded.has(normalizeTrailingSlash(path))) return false;
    if ([...publicPaths, ...excluded].some((prefix) => isExcludedBy(path, prefix))) return false;
    return prefixes.some((prefix) => isUnder(path, prefix));
  };

  return (request) => {
    const url = new URL(request.url);
    // Compared decoded and lowercased, so `/%61ccount` or `/ACCOUNT` (which a case-insensitive
    // front proxy may route to /account) is guarded too. Undecodable paths are guarded.
    const path = decodePath(url.pathname);
    if (path !== null && !isGuarded(path)) return null;
    const cookieHeader = request.headers.get("cookie");
    if (cookieNames.some((name) => readSessionToken(cookieHeader, name) !== null)) return null;
    // Built on appOrigin, or on the request's public origin when the app trusts it: behind a proxy
    // the request URL carries an internal host, and request headers alone are never trusted.
    const login = new URL(routes.login, resolveAppOrigin(config, request, { trustedOrigins }));
    login.searchParams.set("next", `${url.pathname}${url.search}`);
    if (options.redirect !== "relative") return Response.redirect(login, 307);
    // A path-only Location reads no request header at all; `Response.redirect` would need an absolute URL.
    return new Response(null, { status: 307, headers: { location: `${login.pathname}${login.search}` } });
  };
}

function normalizePrefix(prefix: string, kind: "protected" | "excluded"): string {
  if (!prefix.startsWith("/")) {
    throw new Error(`createAuthGuard: ${kind} path "${prefix}" must start with /`);
  }
  return normalizeTrailingSlash(prefix).toLowerCase();
}

function normalizeTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** `entry` as an origin (`https://example.com`, a trailing `/` dropped); anything else is a config error. */
function normalizeOrigin(entry: string): string {
  const parsed = parseOrigin(entry);
  if (parsed === null) {
    throw new Error(`createAuthGuard: trusted origin "${entry}" must be an http(s) origin such as https://example.com`);
  }
  return parsed;
}

function decodePath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname).toLowerCase();
  } catch {
    return null;
  }
}

/** An exclusion of "/" is the home page: excluding every path would switch the guard off. */
function isExcludedBy(pathname: string, prefix: string): boolean {
  return prefix === "/" ? pathname === "/" : isUnder(pathname, prefix);
}

function isUnder(pathname: string, prefix: string): boolean {
  return prefix === "/" || pathname === prefix || pathname.startsWith(`${prefix}/`);
}
