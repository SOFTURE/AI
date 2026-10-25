// The OpenID Connect callback, mounted with one line:
// `app/api/auth/oidc/[provider]/callback/route.ts → export { oidcCallbackRoute as GET } from "@softure-ai/auth/next";`
// The provider sends the browser here with `code` and `state` (or `error`). The answer is always a `303`: to the
// sign-in's `next` with a new session cookie, or to the login page with `?oidc_error=<code>`. The state cookie is
// cleared either way, and the URL (it carries the code) is never sent on as a referrer.
import { errorLogLabel, safeError, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { identifyClient } from "@softure-ai/security/server";
import { resolveRedirectTarget } from "../redirect-target.js";
import { completeOidcSignIn } from "../server/oidc/flow.js";
import { getAuthContext } from "./context.js";
import { clearOidcStateCookie, readOidcStateCookie } from "./oidc-cookie.js";
import { getOidcErrorLoginPath } from "./oidc-login-url.js";
import { endPreviousSession } from "./previous-session.js";
import { writeSessionCookie } from "./session-cookie.js";

const NO_STORE = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

function seeOther(config: SoftureConfig, path: string): Response {
  return new Response(null, { status: 303, headers: { ...NO_STORE, location: new URL(path, config.appOrigin).toString() } });
}

/** `GET /api/auth/oidc/<provider>/callback`. */
export async function oidcCallbackRoute(request: Request, route: { readonly params: Promise<{ readonly provider: string }> }): Promise<Response> {
  const config = getSoftureConfig();
  const { provider } = await route.params;
  const query = new URL(request.url).searchParams;
  const browserState = await readOidcStateCookie(config);
  await clearOidcStateCookie(config);
  const client = identifyClient({ config }, request.headers);
  if (!client.ok) return seeOther(config, getOidcErrorLoginPath(config, client.error));

  try {
    const result = await completeOidcSignIn(await getAuthContext(config), {
      provider,
      params: { state: query.get("state"), code: query.get("code"), error: query.get("error") },
      browserState,
      clientKey: client.value,
    });
    if (!result.ok) return seeOther(config, getOidcErrorLoginPath(config, result.error));
    await endPreviousSession(config);
    await writeSessionCookie(config, result.value.session);
    return seeOther(config, await resolveRedirectTarget(config, result.value.next));
  } catch (error) {
    console.error(`@softure-ai/auth: completing an OpenID Connect sign-in failed: ${errorLogLabel(error)}`);
    return seeOther(config, getOidcErrorLoginPath(config, safeError(error).error));
  }
}
