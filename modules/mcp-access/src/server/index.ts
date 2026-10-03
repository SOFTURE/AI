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
export { checkAccessTokensTable } from "./health.js";
export { getMcpAccessMessages, getMcpAccessOptions, getMcpAccessRoutes, getMcpEndpointUrl, type McpAccessRoutes } from "./options.js";
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
  revokeAccessToken,
  verifyAccessToken,
  type IssueAccessTokenInput,
  type IssueAccessTokenResult,
  type IssuedAccessToken,
  type McpAccessContext,
  type RevokeAccessTokenInput,
  type VerifiedAccessToken,
} from "./tokens.js";
