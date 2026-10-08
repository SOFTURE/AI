// The Next.js adapter of @softure-ai/mcp-access: the MCP route factory, the token page and its
// server actions, and the OAuth routes and consent page (docs/02-module-standard.md §8).
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
export { getMcpAccessContext } from "./context.js";
export { McpAccessPage } from "./pages.js";
export { createMcpRoute } from "./route.js";
