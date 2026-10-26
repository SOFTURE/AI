// The cookie that ties an OpenID Connect sign-in to the browser that started it: it holds the state until the
// provider sends the browser back. Host-only, httpOnly, `SameSite=Lax` (the callback is a top-level GET from the
// provider's site, which Lax lets through) and as short-lived as the sign-in itself.
import type { SoftureConfig } from "@softure-ai/core";
import { cookies } from "next/headers";
import { getSessionCookie } from "../session-cookie.js";
import { getAuthOptions } from "../server/options.js";

function getOidcCookie(config: SoftureConfig) {
  const { secure } = getSessionCookie(config);
  const name = `${secure ? "__Host-" : ""}${getAuthOptions(config).cookie.name}_oidc`;
  return { name, secure, httpOnly: true, sameSite: "lax" as const, path: "/" };
}

export async function writeOidcStateCookie(config: SoftureConfig, state: string, maxAgeSeconds: number): Promise<void> {
  const { name, ...attributes } = getOidcCookie(config);
  (await cookies()).set(name, state, { ...attributes, maxAge: maxAgeSeconds });
}

/** The state of the sign-in this browser started, or null. */
export async function readOidcStateCookie(config: SoftureConfig): Promise<string | null> {
  const value = (await cookies()).get(getOidcCookie(config).name)?.value;
  return value === undefined || value === "" ? null : value;
}

/** Removes the cookie: a state is used once, whatever the callback came to. */
export async function clearOidcStateCookie(config: SoftureConfig): Promise<void> {
  const { name, ...attributes } = getOidcCookie(config);
  const store = await cookies();
  if (store.get(name) !== undefined) store.set(name, "", { ...attributes, maxAge: 0 });
}
