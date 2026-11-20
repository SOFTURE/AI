// What the delete form needs to offer a provider sign-in in place of the password: the signed-in
// user's configured providers, the one whose recent sign-in opened this session, the sign-in action
// and the page to come back to. Read on the server, per request.
import { getCurrentUser, oidcSignInAction } from "@softure-ai/auth/next";
import { getAuthOptions, getOidcProviders } from "@softure-ai/auth/server";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getPrivacyRoutes } from "../server/options.js";
import { getDeletionReauthentication } from "../server/self-service.js";
import type { DeleteAccountReauthentication } from "../ui/delete-account-form.js";
import { getPrivacyContext } from "./context.js";
import { readSessionToken } from "./session-cookie.js";

/**
 * The delete form's `reauthentication` prop for the signed-in user; `next` is the page the form is on (the module's
 * `account` route by default). Without a session the form has nothing to offer, so none is returned.
 */
export async function getDeleteAccountReauthentication(next?: string): Promise<DeleteAccountReauthentication | undefined> {
  const config = getSoftureConfig();
  const user = await getCurrentUser();
  if (user === null) return undefined;
  const sessionToken = await readSessionToken(config);
  const found = await getDeletionReauthentication(await getPrivacyContext(config), { userId: user.id, sessionToken });
  const named = new Map(getOidcProviders(config).map((provider) => [provider.id, { id: provider.id, name: provider.name }]));
  const providers = found.linkedProviders.flatMap((id) => named.get(id) ?? []);
  return {
    providers,
    recentProvider: found.recentProvider === null ? null : (named.get(found.recentProvider) ?? null),
    signInAction: oidcSignInAction,
    next: next ?? getPrivacyRoutes(config).account,
    isPasswordEnabled: getAuthOptions(config).password.enabled,
  };
}
