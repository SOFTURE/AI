// The OAuth callback, mounted with one line:
// `app/api/connections/callback/route.ts → export { completeConnectionRoute as GET } from "@softure-ai/connections/next";`
// The provider redirects the admin's browser here with `code` and `state` (or `error`). The answer is always a
// `303` to the page, with `?connected=<provider>/<account>` or `?error=<code>`; the provider's own error text is
// never carried over. Anyone without the page's role gets `auth.forbidden` and the page's "not found".
import { authorizeRole } from "@softure-ai/auth/next";
import { errorLogLabel, safeError, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { completeAuthorization } from "../server/flow.js";
import { getConnectionsOptions, getConnectionsRoutes } from "../server/options.js";
import { getConnectionsContext } from "./context.js";
import { CONNECTED_PARAM, ERROR_PARAM } from "./notice.js";

const NO_STORE = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

function redirectToPage(config: SoftureConfig, param: string, value: string): Response {
  const url = new URL(getConnectionsRoutes(config).page, config.appOrigin);
  url.searchParams.set(param, value);
  return new Response(null, { status: 303, headers: { ...NO_STORE, location: url.toString() } });
}

/** `GET /api/connections/callback`. */
export async function completeConnectionRoute(request: Request): Promise<Response> {
  const config = getSoftureConfig();
  const admin = await authorizeRole(getConnectionsOptions(config).panelRole);
  if (!admin.ok) return redirectToPage(config, ERROR_PARAM, admin.error);
  const query = new URL(request.url).searchParams;
  try {
    const result = await completeAuthorization(await getConnectionsContext(config), {
      params: { state: query.get("state"), code: query.get("code"), error: query.get("error") },
      actorId: admin.value.id,
    });
    return result.ok
      ? redirectToPage(config, CONNECTED_PARAM, `${result.value.provider}/${result.value.accountId}`)
      : redirectToPage(config, ERROR_PARAM, result.error);
  } catch (error) {
    console.error(`@softure-ai/connections: completing an authorization failed: ${errorLogLabel(error)}`);
    return redirectToPage(config, ERROR_PARAM, safeError(error).error);
  }
}
