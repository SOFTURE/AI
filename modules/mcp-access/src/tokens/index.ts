// Personal access tokens for an app's plain HTTP routes, without the MCP server (#961): nothing this
// entry loads imports `@modelcontextprotocol/*` (tests/api-tokens-961.test.ts walks the graph). A route
// handler checks a request with `requireApiToken` and answers a refusal with `apiTokenErrorResponse`.
export {
  API_RATE_LIMIT_BUCKET,
  API_TOKEN_RATE_LIMIT_BUCKET,
  apiTokenErrorResponse,
  getApiTokenOptions,
  isApiTokenShape,
  issueApiToken,
  requireApiToken,
  verifyApiToken,
  type IssueApiTokenInput,
  type IssueApiTokenResult,
  type IssuedApiToken,
  type RequireApiTokenOptions,
  type VerifiedApiToken,
} from "../server/api-tokens.js";
export { createMcpAccessContext } from "../server/context.js";
export { isWritingEnabled } from "../server/writes-switch.js";
export { hashAccessToken, listAccessTokens, pruneAccessTokens, revokeAccessToken, type McpAccessContext, type RevokeAccessTokenInput } from "../server/tokens.js";
export type { AccessTokenKind, AccessTokenView, ApiTokenErrorCode, ApiTokenIdentity, ApiTokenRefusal } from "../contract.js";
