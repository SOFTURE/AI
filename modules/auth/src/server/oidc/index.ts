// OpenID Connect sign-in (`auth({ oidc })`): the flow, its context and the allowlist check.
export { findOidcProvider, getOidcCallbackPath, getOidcProviders, getOidcRedirectUri, type OidcContext } from "./context.js";
export {
  completeOidcSignIn,
  getAllowedEmail,
  startOidcSignIn,
  type CompleteOidcSignInInput,
  type CompleteOidcSignInResult,
  type OidcCallbackParams,
  type StartedOidcSignIn,
  type StartOidcSignInInput,
  type StartOidcSignInResult,
} from "./flow.js";
export type { IdentityClaims } from "./id-token.js";
