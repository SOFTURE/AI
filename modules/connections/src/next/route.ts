// The OAuth callback, mounted with one line:
// `app/api/connections/callback/route.ts → export { completeConnectionRoute as GET } from "@softure-ai/connections/next";`
// The provider redirects the browser here with `code` and `state` (or `error`). The answer is always a `303`, with
// `?connected=<provider>/<account>` or `?error=<code>`; the provider's own error text is never carried over.
// - An admin (the page's role) completes any authorization they started; the app's own connections go back to the
//   page, their own connections to the provider's `returnPath`.
// - Any other signed-in user completes only an authorization of their own connection (`owner: "user"`) and goes back
//   to the provider's `returnPath`, or to `accountReturnPath` when the state is unknown. Signed out: `auth.forbidden`.
import { authorizeRole, getCurrentUser } from "@softure-ai/auth/next";
import { errorLogLabel, safeError, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { completeAuthorization, type AuthorizationTarget } from "../server/flow.js";
import { findProvider, getConnectionsOptions, getConnectionsRoutes } from "../server/options.js";
import { getConnectionsContext } from "./context.js";
import { CONNECTED_PARAM, ERROR_PARAM } from "./notice.js";

const NO_STORE = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

function redirectTo(config: SoftureConfig, path: string, param: string, value: string): Response {
  const url = new URL(path, config.appOrigin);
  url.searchParams.set(param, value);
  return new Response(null, { status: 303, headers: { ...NO_STORE, location: url.toString() } });
}

/** Where a completion goes back to: a user's own connection to its provider's page, else the admin page (or, for a user, `accountReturnPath`). */
function getReturnPath(config: SoftureConfig, target: AuthorizationTarget | undefined, isAdmin: boolean): string {
  if (target !== undefined && target.ownerId !== null) {
    const found = findProvider(config, target.provider, target.accountId);
    if (found.ok && found.value.kind === "oauth" && found.value.returnPath !== undefined) return found.value.returnPath;
  }
  return isAdmin ? getConnectionsRoutes(config).page : getConnectionsOptions(config).accountReturnPath;
}

/** `GET /api/connections/callback`. */
export async function completeConnectionRoute(request: Request): Promise<Response> {
  const config = getSoftureConfig();
  const admin = await authorizeRole(getConnectionsOptions(config).panelRole);
  const user = admin.ok ? admin.value : await getCurrentUser();
  const isAdmin = admin.ok;
  if (user === null) return redirectTo(config, getConnectionsOptions(config).accountReturnPath, ERROR_PARAM, "auth.forbidden");
  const query = new URL(request.url).searchParams;
  try {
    const result = await completeAuthorization(await getConnectionsContext(config), {
      params: { state: query.get("state"), code: query.get("code"), error: query.get("error") },
      actorId: user.id,
      ownOnly: !isAdmin,
    });
    return result.ok
      ? redirectTo(config, getReturnPath(config, result.value, isAdmin), CONNECTED_PARAM, `${result.value.provider}/${result.value.accountId}`)
      : redirectTo(config, getReturnPath(config, result.target, isAdmin), ERROR_PARAM, result.error);
  } catch (error) {
    console.error(`@softure-ai/connections: completing an authorization failed: ${errorLogLabel(error)}`);
    return redirectTo(config, isAdmin ? getConnectionsRoutes(config).page : getConnectionsOptions(config).accountReturnPath, ERROR_PARAM, safeError(error).error);
  }
}
