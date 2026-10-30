// Server-only API of @softure-ai/mcp-access. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; the endpoint takes a Web `Request`.
export {
  createMcpEndpoint,
  MAX_MCP_REQUEST_BYTES,
  MCP_RATE_LIMIT_BUCKET,
  MCP_READ_SCOPE,
  MCP_WRITE_SCOPE,
  type McpEndpoint,
  type McpEndpointOptions,
  type McpServerFactory,
} from "./endpoint.js";
export { actionTool, toFormData, type ActionToolOptions, type FormActionHandler } from "./action-tool.js";
export { createMcpAccessContext } from "./context.js";
export { isWritingEnabled } from "./writes-switch.js";
export { checkAccessTokensTable } from "./health.js";
export {
  closeClientRegistration,
  findClientRegistrationWindow,
  isClientRegistrationOpen,
  MAX_REGISTRATION_WINDOW_MINUTES,
  openClientRegistration,
  type ClientRegistrationWindow,
  type OpenClientRegistrationInput,
} from "./registration-window.js";
export {
  CONSENT_CODE_PREFIX,
  CLIENT_SECRET_PREFIX,
  createAuthorizationCode,
  exchangeAuthorizationCode,
  findOAuthClient,
  isClientSecretValid,
  listOAuthGrants,
  pruneOAuthRecords,
  REFRESH_TOKEN_PREFIX,
  refreshMcpGrant,
  registerMcpClient,
  revokeOAuthGrant,
  type CreateAuthorizationCodeInput,
  type ExchangeAuthorizationCodeInput,
  type IssuedOAuthTokens,
  type OAuthClientRegistration,
  type PrunedOAuthRecords,
  type RefreshOAuthGrantInput,
  type RegisteredOAuthClient,
  type RevokeOAuthGrantInput,
} from "./oauth.js";
export {
  answerOAuthPreflight,
  AUTHORIZATION_PARAMS,
  AUTHORIZATION_SERVER_METADATA_PATH,
  buildClientRedirect,
  getAuthorizationServerMetadata,
  getConsentPath,
  getOAuthIssuer,
  getProtectedResourceMetadata,
  getProtectedResourceMetadataUrl,
  getRootProtectedResourceMetadata,
  handleAuthorizationDecision,
  handleClientRegistration,
  handleTokenRequest,
  isAcceptableResource,
  isOAuthEnabled,
  isWriteScopeRequested,
  MCP_OAUTH_RATE_LIMIT_BUCKET,
  OAUTH_SCOPES,
  PROTECTED_RESOURCE_METADATA_PATH,
  readAuthorizationParams,
  serveDiscoveryDocument,
  validateAuthorizationRequest,
  type AuthorizationOutcome,
  type AuthorizationPageError,
  type AuthorizationRequest,
  type DiscoveryDocument,
} from "./oauth-http.js";
export { findServedResourceOrigin, readRequestHost, readRequestOrigin, type McpOriginRequest, type McpOrigins } from "../origins.js";
export { resolveMcpOrigins } from "./origins.js";
export type { OAuthClientRow, OAuthTokenEndpointAuthMethod } from "../schema.js";
export { describeRedirectUri, isAllowedRedirectUri, MAX_CLIENT_NAME_LENGTH, parseClientRegistration, type ClientRegistrationResult, type RegistrationError } from "./oauth-validation.js";
export { getCodeChallenge, isPkceVerifierValid, isValidCodeChallenge, PKCE_METHOD } from "./pkce.js";
export { getMcpAccessMessages, getMcpAccessOptions, getMcpAccessRoutes, getMcpEndpointUrl, type McpAccessRoutes } from "./options.js";
export { pruneMcpAccess, type PrunedMcpAccessRecords } from "./prune.js";
export {
  deleteMcpAccessUserData,
  exportMcpAccessUserData,
  mcpAccessPrivacyContributor,
  type McpAccessUserData,
} from "./privacy.js";
export {
  ACCESS_TOKEN_PREFIX,
  hashAccessToken,
  isAccessTokenShape,
  issueAccessToken,
  listAccessTokens,
  pruneAccessTokens,
  findTokenClientName,
  revokeAccessToken,
  verifyAccessToken,
  type IssueAccessTokenInput,
  type IssueAccessTokenResult,
  type IssuedAccessToken,
  type McpAccessContext,
  type RevokeAccessTokenInput,
  type VerifiedAccessToken,
} from "./tokens.js";
export { createMcpServerFactory, type McpServerFactoryOptions } from "./server-factory.js";
export {
  registerServerInfoTool,
  SERVER_INFO_TOOL_NAME,
  type McpBuildInfo,
  type RegisterServerInfoToolOptions,
  type ServedServerInfo,
  type ServerInfoAnswer,
  type ServerInfoToolOptions,
} from "./server-info.js";
export { toStrictToolInput, withStrictToolInput, type StrictToolInputMessages, type StrictToolInputOptions } from "./strict-input.js";
export {
  DEFAULT_TOOL_LIST_RELEASE,
  describeToolList,
  fingerprintToolList,
  listServedTools,
  measureToolList,
  type MeasureToolListOptions,
  type RegisterTools,
  type ServedTool,
  type ToolListMeasurement,
} from "./tool-list.js";
export {
  toolError,
  toolResult,
  withToolErrors,
  type ToolCaller,
  type ToolCallHook,
  type ToolCallOutcome,
  type ToolCallRecord,
  type ToolErrorHints,
  type ToolErrorOptions,
} from "./tools.js";
