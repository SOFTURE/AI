// Reading and writing the session cookie through Next's request scope.
import type { SoftureConfig } from "@softure-ai/core";
import { cookies } from "next/headers";
import type { NewSession } from "../contract.js";
import { getAuthOptions } from "../server/options.js";
import { getSessionCookie } from "../session-cookie.js";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function readCookie(store: CookieStore, name: string): string | null {
  const value = store.get(name)?.value;
  return value === undefined || value === "" ? null : value;
}

/** The request's session token: the current cookie's, else the legacy session's (`legacySession`). */
export async function readSessionToken(config: SoftureConfig): Promise<string | null> {
  const store = await cookies();
  return readCookie(store, getSessionCookie(config).name) ?? (await readLegacySessionToken(config));
}

/** The legacy session cookie's token, or null (also without `legacySession`). */
export async function readLegacySessionToken(config: SoftureConfig): Promise<string | null> {
  const name = getAuthOptions(config).legacySession?.cookieName;
  return name === undefined ? null : readCookie(await cookies(), name);
}

/**
 * Removes the legacy cookie, if the app declared one: with `Path=/` and the configured domain, the
 * only attributes the module knows. A legacy cookie set on another path or domain stays until it
 * expires; its session row is ended anyway.
 */
async function clearLegacySessionCookie(config: SoftureConfig): Promise<void> {
  const name = getAuthOptions(config).legacySession?.cookieName;
  if (name === undefined) return;
  const store = await cookies();
  if (store.get(name) === undefined) return;
  const cookie = getSessionCookie(config);
  store.set(name, "", { httpOnly: true, secure: cookie.secure, sameSite: cookie.sameSite, path: "/", domain: cookie.domain, maxAge: 0 });
}

/** Only in a server action or a route handler: pages cannot set cookies. */
export async function writeSessionCookie(config: SoftureConfig, session: NewSession): Promise<void> {
  const cookie = getSessionCookie(config);
  const store = await cookies();
  store.set(cookie.name, session.token, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    domain: cookie.domain,
    maxAge: cookie.maxAgeSeconds,
  });
  // A new session replaces the legacy one: the browser keeps one cookie from here on.
  await clearLegacySessionCookie(config);
}

/** Removes the cookie with the attributes it was set with, so the browser drops that one. */
export async function clearSessionCookie(config: SoftureConfig): Promise<void> {
  const cookie = getSessionCookie(config);
  const store = await cookies();
  store.set(cookie.name, "", {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    domain: cookie.domain,
    maxAge: 0,
  });
  await clearLegacySessionCookie(config);
}
