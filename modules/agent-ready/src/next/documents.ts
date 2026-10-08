// What the routes share: the request's document context, the authorization server metadata, the introspected server
// and the rendered skills. Each call reads the request: nothing is cached between hosts.
import type { SoftureConfig } from "@softure-ai/core";
import { renderAppSkills, type AgentSkill } from "../agent-skills.js";
import type { AuthorizationServerMetadata } from "../auth-md.js";
import type { AgentDocumentContext } from "../context.js";
import type { McpServerDescription } from "../mcp-description.js";
import { buildMcpSkill, getMcpSkillName } from "../mcp-skill.js";
import type { OriginRequest } from "../origins.js";
import { AUTHORIZATION_SERVER_METADATA_PATH } from "../paths.js";
import { readServerDescription, SDK_PROTOCOL_VERSIONS } from "../server/introspect.js";
import { resolveDocumentContext } from "../settings.js";

/**
 * The request the token issuer's metadata provider gets: addressed to the resolved app origin, so an issuer that
 * resolves origins from the request (mcp-access with `resolveAppOrigin`) names the same host as these documents.
 */
export function createIssuerRequest(appOrigin: string): OriginRequest {
  const url = new URL(AUTHORIZATION_SERVER_METADATA_PATH, appOrigin);
  return { url: url.href, headers: new Headers({ host: url.host, "x-forwarded-proto": url.protocol.replace(/:$/, "") }) };
}

/**
 * The issuer's metadata for the request's origins, or null when the app configured no OAuth. An issuer on another
 * origin than the app origin is a setup bug (the documents would send agents to a `resource` the issuer refuses):
 * thrown by name, so the route answers 500 instead of serving it.
 */
export async function readIssuerMetadata(context: AgentDocumentContext): Promise<AuthorizationServerMetadata | null> {
  const provider = context.options.oauth?.authorizationServerMetadata;
  if (provider === undefined) return null;
  const metadata = await provider(createIssuerRequest(context.origins.appOrigin), context.origins);
  const issuer = metadata.issuer;
  if (typeof issuer === "string" && URL.canParse(issuer) && new URL(issuer).origin !== context.origins.appOrigin) {
    throw new Error(
      `@softure-ai/agent-ready: the issuer ${new URL(issuer).origin} is not the app origin ${context.origins.appOrigin}; give both modules the same app origin`,
    );
  }
  return metadata;
}

/** The app's MCP server as an anonymous client sees it. */
export function describeServer(context: AgentDocumentContext): Promise<McpServerDescription> {
  const { mcp } = context.options;
  return readServerDescription(mcp.server, { path: mcp.path, ...(mcp.protocolVersions === undefined ? {} : { protocolVersion: mcp.protocolVersions[0] }) });
}

/** The protocol versions the server card announces: configured, else the SDK's. */
export function getSupportedProtocolVersions(context: AgentDocumentContext): readonly string[] {
  return context.options.mcp.protocolVersions ?? SDK_PROTOCOL_VERSIONS;
}

/** Every published skill: the app's, then the generated MCP skill. */
export async function renderSkills(context: AgentDocumentContext): Promise<AgentSkill[]> {
  const skills = renderAppSkills(context);
  if (context.options.mcpSkill === false) return skills;
  const [description, metadata] = await Promise.all([describeServer(context), readIssuerMetadata(context)]);
  const mcpSkill = buildMcpSkill(context, description, metadata);
  return mcpSkill === null ? skills : [...skills, mcpSkill];
}

/** The one skill named `name`: the app's, or the generated MCP skill; none for any other name, without building anything. */
export async function renderSkill(context: AgentDocumentContext, name: string): Promise<AgentSkill[]> {
  const own = renderAppSkills(context).filter((skill) => skill.name === name);
  if (own.length > 0 || getMcpSkillName(context) !== name) return own;
  const [description, metadata] = await Promise.all([describeServer(context), readIssuerMetadata(context)]);
  const mcpSkill = buildMcpSkill(context, description, metadata);
  return mcpSkill === null ? [] : [mcpSkill];
}

export function getDocumentContext(config: SoftureConfig, request: OriginRequest): AgentDocumentContext {
  return resolveDocumentContext(config, request);
}
