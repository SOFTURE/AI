// Public API of @softure-ai/agent-ready: the module factory for softure.config.ts, the origin resolver and every
// document builder. Route handlers are in `@softure-ai/agent-ready/next`, Web Bot Auth signing and MCP introspection
// in `/server`, the browser runtime in `/webmcp`, the guards in `/testing`. This entry imports no database and no
// `@softure-ai/core/next`, so `next.config.ts` and `proxy.ts` can load it.
import { defineModule } from "@softure-ai/core";
import { AGENT_READY_MOUNTS } from "./manifest-mounts.js";
import { agentReadyMessages } from "./messages/index.js";
import { agentReadyOptionsSchema } from "./options.js";
import { MODULE_ID } from "./settings.js";

/**
 * Enables agent discovery in `softure.config.ts`, e.g.
 * `agentReady({ name: "com.example/app", title: "Example", description: "…", provider: { organization: "Example" },
 * mcp: { server: async () => (await import("./mcp/server")).createAnonymousServer() } })`. Mount the routes from
 * `@softure-ai/agent-ready/next`.
 */
export const agentReady = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.0",
    dependsOn: {},
    dbSchema: null,
    tables: [],
    env: [
      { name: "WEB_BOT_AUTH_PRIVATE_KEY", required: false, description: "Ed25519 seed (base64url JWK d) that signs outgoing requests; the name is the webBotAuth.privateKeyEnv option" },
      { name: "WEB_BOT_AUTH_RETIRED_PUBLIC_KEYS", required: false, description: "retired public keys (x), comma-separated, still published in the directory; the name is the webBotAuth.retiredKeysEnv option" },
    ],
    switches: [],
    routes: {},
    mount: [...AGENT_READY_MOUNTS],
    privacy: { exports: false, deletes: false },
  },
  messages: agentReadyMessages,
  options: agentReadyOptionsSchema,
});

export { buildA2aAgentCard, A2A_MCP_BINDING } from "./a2a-card.js";
export {
  AGENT_SKILLS_SCHEMA,
  buildAgentSkillsIndex,
  createAgentSkill,
  digestOf,
  findAgentSkill,
  frontmatter,
  renderAppSkills,
  SKILL_MD_CONTENT_TYPE,
  type AgentSkill,
  type AgentSkillsIndex,
} from "./agent-skills.js";
export {
  AI_CATALOG_SPEC_VERSION,
  buildAgentmapDirective,
  buildAiCatalog,
  buildAirIdentifier,
  CATALOG_ENTRY_IDS,
  type AiCatalog,
  type AiCatalogEntry,
} from "./ai-catalog.js";
export { API_CATALOG_CONTENT_TYPE, buildApiCatalog, MCP_SERVER_CARD_MEDIA_TYPE, type ApiCatalog, type LinkTarget } from "./api-catalog.js";
export { AUTH_MD_CONTENT_TYPE, buildAuthMd, listMetadataUrls, type AuthorizationServerMetadata } from "./auth-md.js";
export {
  getAuthDocumentationUrl,
  getMcpEndpointUrl,
  getMcpServerTitle,
  getServiceDocTitle,
  getServiceDocUrl,
  type AgentDocumentContext,
} from "./context.js";
export {
  DNS_AID_ALPN,
  DNS_AID_PORT,
  DNS_AID_TTL,
  dohResponseSchema,
  evaluateDnsAid,
  formatZoneLine,
  parseSvcbData,
  resolveDnsAidRecords,
  type DnsAidCheck,
  type DnsAidRecord,
  type DohResponse,
  type ResolvedDnsAid,
  type SvcbRecord,
} from "./dns-aid.js";
export { DISCOVERY_CACHE_SECONDS, SHORT_DISCOVERY_CACHE_SECONDS, discoveryHeaders, prettyJson } from "./http.js";
export { buildHomeLinkHeader, getHomeLinks, nextHeaders, type HomeLink, type HomeLinkOptions, type NextHeaderRule } from "./link-header.js";
export { AGENT_READY_MOUNTS } from "./manifest-mounts.js";
export { getMcpSkillName, buildMcpSkill } from "./mcp-skill.js";
export { getRequiredScopes, isWriteTool, type McpListedTool, type McpServerDescription, type McpToolAnnotations } from "./mcp-description.js";
export { agentReadyMessages, type AgentReadyMessages } from "./messages/index.js";
export {
  buildAgentAuthMetadata,
  buildResourceDocumentation,
  createAgentAuthExtension,
  EMPTY_JWKS,
  getResourceMetadataUrl,
  type AgentAuthExtensionOptions,
  type AgentAuthMetadataInput,
} from "./oauth.js";
export { buildOpenApiDocument, type OAuthEndpoints } from "./openapi.js";
export {
  agentReadyOptionsSchema,
  getDefaultMcpSkillName,
  isBareOrigin,
  MAX_CATALOG_QUERIES,
  MAX_SKILL_DESCRIPTION_LENGTH,
  MIN_CATALOG_QUERIES,
  type AgentReadyOptions,
  type AgentReadyOptionsInput,
  type AgentSkillInput,
  type AppOriginResolver,
  type AuthorizationServerMetadataProvider,
  type McpServerFactory,
} from "./options.js";
export {
  createOrigins,
  readRequestHost,
  readRequestOrigin,
  resolveOrigins,
  trimOrigin,
  type AgentOrigins,
  type OriginRequest,
  type OriginSettings,
} from "./origins.js";
export * from "./paths.js";
export { buildMcpServerCard, MCP_SERVER_CARD_SCHEMA, type ServerCardInput } from "./server-card.js";
export { getAgentReadyOptions, MODULE_ID, resolveDocumentContext } from "./settings.js";
export { buildVerifyManifest, type VerifyManifestOptions, type VerifyRoute } from "./verify.js";
