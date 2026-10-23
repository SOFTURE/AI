// Server-only API of @softure-ai/connections. Every function receives the module context (`{ db, clock, config }`,
// plus an optional `env`) and never reads request scope.
export {
  CONNECTIONS_KEYS_ENV,
  generateConnectionsKey,
  openSecret,
  readKeyring,
  sealSecret,
  type ConnectionsKey,
  type Env,
  type Keyring,
  type KeyringResult,
  type OpenSecretResult,
  type SealedSecret,
} from "./crypto.js";
export {
  disconnect,
  getAuthorizationHeader,
  getCredential,
  MAX_CREDENTIAL_LENGTH,
  reportCredentialRejected,
  saveCredential,
  type CredentialInput,
  type DisconnectResult,
  type GetCredentialResult,
  type ProviderAccountInput,
  type SaveCredentialInput,
} from "./credentials.js";
export {
  completeAuthorization,
  startAuthorization,
  type CallbackParams,
  type CompleteAuthorizationInput,
  type CompleteAuthorizationResult,
  type StartAuthorizationInput,
  type StartAuthorizationResult,
} from "./flow.js";
export { checkConnectionsTables } from "./health.js";
export { getConnection, getStatus, listConnections } from "./list.js";
export {
  findProvider,
  getConnectionsModule,
  getConnectionsOptions,
  getConnectionsRoutes,
  getProviderLabel,
  getRedirectUri,
  readClientCredentials,
  type ConnectionsRoutes,
} from "./options.js";
export {
  connectionsPrivacyContributor,
  deleteConnectionsUserData,
  exportConnectionsUserData,
  type ConnectionsDeletionReport,
  type ConnectionsPrivacyContext,
  type ConnectionsUserData,
} from "./privacy.js";
export { reencryptConnections, type ReencryptOptions, type ReencryptReport } from "./rotate.js";
export type { ConnectionsContext } from "./store.js";
export { getAccessToken, replaceRejectedToken, type GetAccessTokenInput, type GetAccessTokenResult, type ReplaceRejectedTokenInput } from "./tokens.js";
