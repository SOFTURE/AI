// Ending the browser's session cookie after the account is gone. The database sessions are
// deleted with the account; this removes the cookie with the attributes auth set it with.
import { getSessionCookie } from "@softure-ai/auth";
import type { SoftureConfig } from "@softure-ai/core";
import { cookies } from "next/headers";

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
