// Public API of @softure-ai/mcp-access: the module factory for softure.config.ts, its rate limit
// bucket, types, messages, table and the pure helpers for token status and client setup. Database
// work and the endpoint are in `@softure-ai/mcp-access/server`, the Next.js adapter (route, page,
// actions) in `/next`, the token manager in `/ui`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { mcpAccessMessages } from "./messages/index.js";
import { mcpAccessOptionsSchema } from "./options.js";
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
} as const;

/**
 * Enables MCP access in `softure.config.ts` (after `security` and `auth`):
 * `mcpAccess({ serverName: "acme", tools: [{ name: "list_orders", access: "read", description: { en: "Lists your orders." } }] })`.
 */
export const mcpAccess = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.0",
    dependsOn: { security: "^0.1.0", auth: "^0.1.0" },
    dbSchema: "mcp",
    tables: ["access_tokens"],
    env: [],
    switches: [],
    routes: { page: "/account/mcp", endpoint: "/api/mcp" },
    mount: [
      { kind: "page", path: "app/account/mcp/page.tsx", export: "McpAccessPage" },
      { kind: "route-handler", path: "app/api/mcp/route.ts", export: "createMcpRoute" },
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
  McpClientSetup,
  McpServerIdentity,
  RevokeTokenFormState,
  TokenFormErrorCode,
} from "./contract.js";
export { getTokenErrorMessage, mcpAccessMessages, type McpAccessMessages } from "./messages/index.js";
export {
  MAX_TOKEN_NAME_LENGTH,
  SERVER_NAME_PATTERN,
  TOOL_NAME_PATTERN,
  type McpAccessOptions,
  type McpAccessOptionsInput,
  type McpToolAccess,
  type McpToolDefinition,
  type McpToolDefinitionInput,
} from "./options.js";
export { accessTokens } from "./schema.js";
export { getAccessTokenStatus, type AccessTokenStatusOptions } from "./token-status.js";
