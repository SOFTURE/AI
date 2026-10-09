// Public API of @softure-ai/mcp-access: the module factory for softure.config.ts, its rate limit
// bucket, types, messages, table and the pure helpers for token status and client setup. Database
// work and the endpoint are in `@softure-ai/mcp-access/server`, the Next.js adapter (route, page,
// actions) in `/next`, the token manager in `/ui`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { mcpAccessMessages } from "./messages/index.js";
import { mcpAccessOptionsSchema } from "./options.js";
import { DEFAULT_MCP_ACCESS_ROUTES } from "./routes.js";
import { checkAccessTokensTable } from "./server/health.js";
import { mcpAccessPrivacyContributor } from "./server/privacy.js";

export const MODULE_ID = "mcp-access";

/**
 * The rate limit bucket of `POST /api/mcp`, to spread into `security({ buckets })`: requests per
 * client address, counted before the token is verified. Every request counts, so the limit is for
 * the traffic behind one address (several assistants share it), not for one token.
 */
export const MCP_RATE_LIMIT_BUCKETS = {
  mcp: { limit: 200, windowMinutes: 15 },
  /**
   * OAuth registration (per address) and token requests (per address and client id), when
   * `oauth.enabled`. Enough for an assistant platform refreshing many users' tokens per client,
   * too little for a script filling the clients table.
   */
  "mcp-oauth": { limit: 60, windowMinutes: 15 },
} as const;

/**
 * Enables MCP access in `softure.config.ts` (after `security` and `auth`):
 * `mcpAccess({ serverName: "acme", tools: [{ name: "list_orders", access: "read", description: { en: "Lists your orders." } }] })`.
 */
export const mcpAccess = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.13",
    dependsOn: { security: "^0.1.0", auth: "^0.1.0" },
    dbSchema: "mcp",
    tables: ["access_tokens", "oauth_clients", "oauth_authorization_codes", "oauth_grants"],
    env: [],
    switches: [],
    routes: { ...DEFAULT_MCP_ACCESS_ROUTES },
    mount: [
      { kind: "page", path: "app/account/mcp/page.tsx", export: "McpAccessPage" },
      { kind: "route-handler", path: "app/api/mcp/route.ts", export: "createMcpRoute" },
      { kind: "page", path: "app/oauth/authorize/page.tsx", export: "OAuthConsentPage" },
      { kind: "route-handler", path: "app/api/oauth/authorize/route.ts", export: "decideOAuthAuthorizationRoute" },
      { kind: "route-handler", path: "app/api/oauth/token/route.ts", export: "exchangeOAuthTokenRoute" },
      { kind: "route-handler", path: "app/api/oauth/register/route.ts", export: "registerOAuthClientRoute" },
      { kind: "route-handler", path: "app/.well-known/oauth-authorization-server/route.ts", export: "getAuthorizationServerMetadataRoute" },
      { kind: "route-handler", path: "app/.well-known/oauth-protected-resource/route.ts", export: "getProtectedResourceMetadataRoute" },
      { kind: "route-handler", path: "app/.well-known/oauth-protected-resource/api/mcp/route.ts", export: "getProtectedResourceMetadataRoute" },
    ],
    privacy: { exports: true, deletes: true },
  },
  messages: mcpAccessMessages,
  options: mcpAccessOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: mcpAccessPrivacyContributor,
  health: checkAccessTokensTable,
});

export {
  getAuthorizationHeader,
  getClaudeCodeCommand,
  getClaudeCodeLink,
  getDesktopConfig,
  getJsonConfig,
  getMcpClientSetup,
  type McpClientSetupInput,
} from "./client-setup.js";
export type {
  AccessTokenStatus,
  AccessTokenView,
  IssuedToken,
  IssueTokenFormState,
  McpAccessErrorCode,
  McpIssueRefusalCode,
  McpClientSetup,
  McpServerIdentity,
  OAuthGrantView,
  RevokeGrantFormState,
  RevokeTokenFormState,
  TokenFormErrorCode,
} from "./contract.js";
export { getTokenErrorMessage, mcpAccessMessages, type McpAccessMessages } from "./messages/index.js";
export {
  MAX_PRESENTED_TOKEN_LENGTH,
  MAX_TOKEN_NAME_LENGTH,
  SERVER_NAME_PATTERN,
  TOOL_NAME_PATTERN,
  GENERATED_AUTHORIZATION_SERVER_KEYS,
  GENERATED_PROTECTED_RESOURCE_KEYS,
  type McpAccessOptions,
  type McpAccessOptionsInput,
  type McpAppOriginResolver,
  type McpMetadataExtension,
  type McpOAuthOptions,
  type McpToolAccess,
  type McpToolDefinition,
  type McpToolDefinitionInput,
} from "./options.js";
export { DEFAULT_MCP_ACCESS_ROUTES } from "./routes.js";
export { readRequestOrigin, type McpOriginRequest, type McpOrigins } from "./origins.js";
export { accessTokens, oauthAuthorizationCodes, oauthClients, oauthGrants, type OAuthClientRow, type OAuthTokenEndpointAuthMethod } from "./schema.js";
export { getAccessTokenStatus, type AccessTokenStatusOptions } from "./token-status.js";
