// The signed-in user for server components, actions and route handlers. React's `cache` makes it
// one session lookup per request, however many components ask.
import { getSoftureConfig } from "@softure-ai/core/next";
import { redirect } from "next/navigation.js";
import { cache } from "react";
import type { AuthUser } from "../contract.js";
import { toSafeNextPath } from "../safe-next-path.js";
import { getAuthRoutes } from "../server/options.js";
import { findSessionUser } from "../server/sessions.js";
import { getAuthContext } from "./context.js";
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
}

/** The signed-in user; without one, a redirect to the login page (with `next` when given). */
export async function requireUser(options: RequireUserOptions = {}): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user !== null) return user;
  const login = getAuthRoutes(getSoftureConfig()).login;
  const next = options.next === undefined ? null : toSafeNextPath(options.next, "");
  redirect(next === null || next === "" ? login : `${login}?next=${encodeURIComponent(next)}`);
}
