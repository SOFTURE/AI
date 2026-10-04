// The signed-in user and their roles for server components, actions and route handlers. React's
// `cache` makes each one lookup per request, however many components ask; nothing is cached
// across requests, so a revoked role is gone on the next one.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { AuthUser } from "../contract.js";
import { resolveRedirectTarget } from "../redirect-target.js";
import { toSafeNextPath } from "../safe-next-path.js";
import { getAuthRoutes } from "../server/options.js";
import { assertDeclaredRole, findUserRoles } from "../server/roles.js";
import { findSessionUser } from "../server/sessions.js";
import { getAuthContext } from "./context.js";
import { toUrlSearchParams, type PageSearchParams } from "./search-params.js";
import { readSessionToken } from "./session-cookie.js";

/** The user of the request's session, or null. Database failures propagate to the error page. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const config = getSoftureConfig();
  const token = await readSessionToken(config);
  if (token === null) return null;
  return findSessionUser(await getAuthContext(config), token);
});

export interface RequireUserOptions {
  /** Where to come back after login; a same-origin path. */
  readonly next?: string;
  /**
   * A page's own search params (awaited), handed to the app's `rewriteRedirect` so the login URL
   * can keep the page's channel tag. Without them the rewrite reads as for an action.
   */
  readonly searchParams?: PageSearchParams | undefined;
}

/**
 * The signed-in user; without one, a redirect to the login page (with `next` when given), through
 * the app's `rewriteRedirect`.
 */
export async function requireUser(options: RequireUserOptions = {}): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user !== null) return user;
  const config = getSoftureConfig();
  const login = getAuthRoutes(config).login;
  const next = options.next === undefined ? null : toSafeNextPath(options.next, "");
  const path = next === null || next === "" ? login : `${login}?next=${encodeURIComponent(next)}`;
  const searchParams = options.searchParams === undefined ? undefined : toUrlSearchParams(options.searchParams);
  redirect(await resolveRedirectTarget(config, path, searchParams));
}

const NO_ROLES: ReadonlySet<string> = new Set();

/** The roles of the request's user; none without a session. */
export const getCurrentUserRoles = cache(async (): Promise<ReadonlySet<string>> => {
  const user = await getCurrentUser();
  if (user === null) return NO_ROLES;
  return findUserRoles(await getAuthContext(), user);
});

/** The signed-in user when they hold `role`, else null. Throws for an undeclared role. */
async function findUserWithRole(role: string): Promise<AuthUser | null> {
  assertDeclaredRole(getSoftureConfig(), role);
  const user = await getCurrentUser();
  if (user === null) return null;
  return (await getCurrentUserRoles()).has(role) ? user : null;
}

/**
 * For pages, layouts and route handlers: the signed-in user when they hold `role`; for anyone
 * else, signed in or not, Next's "not found", so the surface does not reveal that it exists.
 */
export async function requireRole(role: string): Promise<AuthUser> {
  const user = await findUserWithRole(role);
  if (user === null) notFound();
  return user;
}

/**
 * For server actions: the signed-in user when they hold `role`, else `auth.forbidden` (also
 * without a session), for the action to return to its form. Call it before reading any input.
 */
export async function authorizeRole(role: string): Promise<Ok<AuthUser> | Err<"auth.forbidden">> {
  const user = await findUserWithRole(role);
  return user === null ? err("auth.forbidden") : ok(user);
}

/** For UI decisions such as showing a link; never the access check itself. */
export async function hasRole(role: string): Promise<boolean> {
  return (await findUserWithRole(role)) !== null;
}
