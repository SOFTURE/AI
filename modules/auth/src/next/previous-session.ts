// The sessions a browser already holds when it signs in again, ended before the new cookie is written, so they
// cannot be reused. Shared by the login and register actions and the OpenID Connect callback.
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import { logoutSession } from "../server/sessions.js";
import { getAuthContext } from "./context.js";
import { readLegacySessionToken, readSessionToken } from "./session-cookie.js";

/** Every session token the browser holds: the current cookie's and a legacy session's. */
export async function readHeldTokens(config: SoftureConfig): Promise<string[]> {
  const tokens = [await readSessionToken(config), await readLegacySessionToken(config)];
  return [...new Set(tokens.filter((token) => token !== null))];
}

/** Ends the sessions the browser held before a sign-in. A failure is logged: the new session still opens. */
export async function endPreviousSession(config: SoftureConfig): Promise<void> {
  for (const previous of await readHeldTokens(config)) {
    try {
      await logoutSession(await getAuthContext(config), previous);
    } catch (error) {
      console.error(`@softure-ai/auth: ending the previous session failed: ${errorLogLabel(error)}`);
    }
  }
}
