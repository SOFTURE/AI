// `@softure-ai/connections/user-oauth`: OAuth 2.0 connections that belong to the app's own users (each user connects
// their own account at a provider: a cloud drive, a code host), one grant per user kept by the app beside its records.
// The state and PKCE secrets, the authorize URL, the code exchange, refreshes, revocation and sealing a grant to its
// user. Stateless and Workers-safe; it needs neither the module's tables nor its configuration.
export {
  buildUserAuthorizationUrl,
  exchangeUserCode,
  refreshUserAccessToken,
  revokeUserGrant,
  type UserAuthorizationUrlInput,
  type UserCodeExchangeInput,
  type UserOAuthCallOptions,
  type UserOAuthFailure,
  type UserOAuthFailureCode,
  type UserOAuthGrant,
  type UserOAuthResult,
} from "./client.js";
export { defineUserOAuthProvider, type UserOAuthClient, type UserOAuthProvider, type UserOAuthProviderInput } from "./provider.js";
export { openUserSecret, sealUserSecret, type OpenUserSecretResult, type UserSecretOwner } from "./secrets.js";
export { createCodeChallenge, createUserOAuthState, hashUserOAuthState, type UserOAuthState } from "./state.js";
export { generateConnectionsKey, readKeyring, type Keyring, type KeyringResult } from "../server/crypto.js";
