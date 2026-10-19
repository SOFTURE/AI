// The Next.js adapter of @softure-ai/mcp-access: the MCP route factory, the token page, its prop
// builder and its server actions, and the OAuth routes and consent page (docs/02-module-standard.md §8).
export { issueTokenAction, revokeGrantAction, revokeTokenAction } from "./actions.js";
export { OAuthConsentPage, type OAuthConsentPageProps } from "./oauth-page.js";
export {
  answerOAuthPreflight,
  decideOAuthAuthorizationRoute,
  exchangeOAuthTokenRoute,
  getAuthorizationServerMetadataRoute,
  getProtectedResourceMetadataRoute,
  registerOAuthClientRoute,
} from "./oauth-routes.js";
export { getMcpAccessContext, getRequestOrigins } from "./context.js";
export { issueToken, refuseIssue, type BeforeIssueGate, type IssueGateInput, type IssueGateResult, type IssueTokenOptions } from "./issue-token.js";
export { McpAccessPage, type McpAccessPageProps } from "./pages.js";
export { createMcpRoute } from "./route.js";
export { getTokenManagerProps, type TokenManagerData, type TokenManagerPropsInput } from "./token-manager-props.js";
