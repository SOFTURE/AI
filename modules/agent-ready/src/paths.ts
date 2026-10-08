// The fixed paths of the documents this package serves. Each is where a spec or a scanner looks, so none is an option.

/** RFC 9727 §3: the API catalog. */
export const API_CATALOG_PATH = "/.well-known/api-catalog";
/** The OpenAPI description of the MCP endpoint, at the root where agents look for it. */
export const OPENAPI_PATH = "/openapi.json";
/** WorkOS auth.md: how an agent gets a token, at the root. */
export const AUTH_MD_PATH = "/auth.md";
/** The JWKS an authorization server names in `jwks_uri`. */
export const JWKS_PATH = "/.well-known/jwks.json";
/** RFC 8414 §3: authorization server metadata (served by the token issuer, e.g. `@softure-ai/mcp-access`). */
export const AUTHORIZATION_SERVER_METADATA_PATH = "/.well-known/oauth-authorization-server";
/** RFC 9728 §3: protected resource metadata; the endpoint's own variant appends its path. */
export const PROTECTED_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";
/** MCP SEP-1649 / SEP-2127: the server card. */
export const MCP_SERVER_CARD_PATH = "/.well-known/mcp/server-card.json";
/** A2A 1.0 (RFC 8615): the agent card. */
export const A2A_AGENT_CARD_PATH = "/.well-known/agent-card.json";
/** Agent Skills Discovery v0.2.0: the prefix of the index and of every `SKILL.md`. */
export const AGENT_SKILLS_PREFIX = "/.well-known/agent-skills";
/** Agent Skills Discovery v0.2.0: the index. */
export const AGENT_SKILLS_INDEX_PATH = `${AGENT_SKILLS_PREFIX}/index.json`;
/** ARD 1.0: the AI catalog. */
export const AI_CATALOG_PATH = "/.well-known/ai-catalog.json";
/** Web Bot Auth: the key directory a verifier appends to the origin in `Signature-Agent`. */
export const WEB_BOT_AUTH_DIRECTORY_PATH = "/.well-known/http-message-signatures-directory";

/** The path of one skill's `SKILL.md`, relative to the root of the host that serves the index. */
export function skillPath(name: string): string {
  return `${AGENT_SKILLS_PREFIX}/${name}/SKILL.md`;
}
