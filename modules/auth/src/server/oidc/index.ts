// Sign-in through a provider (`auth({ oidc })`, OpenID Connect or GitHub): the flow, its context and the allowlist.
export { findOidcProvider, getOidcCallbackPath, getOidcProviders, getOidcRedirectUri, type OidcContext } from "./context.js";
export {
  completeOidcSignIn,
  startOidcSignIn,
  type CompleteOidcSignInInput,
  type CompleteOidcSignInResult,
  type OidcCallbackParams,
  type StartedOidcSignIn,
  type StartOidcSignInInput,
  type StartOidcSignInResult,
} from "./flow.js";
export { getAllowedEmail } from "./allowlist.js";
export type { IdentityClaims } from "./id-token.js";
