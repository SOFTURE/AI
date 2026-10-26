// The login page a failed OpenID Connect sign-in goes back to, with the error code it shows.
import type { SoftureConfig } from "@softure-ai/core";
import { toSafeNextPath } from "../safe-next-path.js";
import { getAuthRoutes } from "../server/options.js";
import { OIDC_ERROR_PARAM } from "./params.js";

/** `<login>?oidc_error=<code>[&next=…]`, a path on this app. */
export function getOidcErrorLoginPath(config: SoftureConfig, code: string, next?: string): string {
  const routes = getAuthRoutes(config);
  const query = new URLSearchParams({ [OIDC_ERROR_PARAM]: code });
  const target = toSafeNextPath(next, routes.afterLogin);
  if (target !== routes.afterLogin) query.set("next", target);
  return `${routes.login}?${query.toString()}`;
}
