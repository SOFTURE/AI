// Reading and writing the session cookie through Next's request scope.
import type { SoftureConfig } from "@softure-ai/core";
import { cookies } from "next/headers";
import type { NewSession } from "../contract.js";
import { getSessionCookie } from "../session-cookie.js";

export async function readSessionToken(config: SoftureConfig): Promise<string | null> {
  const store = await cookies();
  const value = store.get(getSessionCookie(config).name)?.value;
  return value === undefined || value === "" ? null : value;
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
}
