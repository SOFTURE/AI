// The browser's session cookie: read, so a deletion can check the sign-in that opened this session,
// and ended after the account is gone. The database sessions are deleted with the account; this
// removes the cookie with the attributes auth set it with.
import { getSessionCookie } from "@softure-ai/auth";
import type { SoftureConfig } from "@softure-ai/core";
import { cookies } from "next/headers";

/** The request's session token, or null without the cookie. */
export async function readSessionToken(config: SoftureConfig): Promise<string | null> {
  const value = (await cookies()).get(getSessionCookie(config).name)?.value;
  return value === undefined || value === "" ? null : value;
}

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
