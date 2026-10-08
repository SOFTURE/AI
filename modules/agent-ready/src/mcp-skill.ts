// The generated skill that tells an agent how to connect to the app's MCP server: the endpoint, both ways to a token,
// and the tools the server lists, read and write apart. Everything comes from configuration, the authorization
// server metadata and the introspected tools, so it changes with them.
import { createAgentSkill, type AgentSkill } from "./agent-skills.js";
import type { AuthorizationServerMetadata } from "./auth-md.js";
import { getMcpEndpointUrl, getServiceDocUrl, type AgentDocumentContext } from "./context.js";
import { isWriteTool, type McpListedTool, type McpServerDescription } from "./mcp-description.js";
import { getResourceMetadataUrl } from "./oauth.js";
import { getDefaultMcpSkillName } from "./options.js";
import { AUTH_MD_PATH, AUTHORIZATION_SERVER_METADATA_PATH } from "./paths.js";

function describeTool(tool: McpListedTool): string {
  const summary = (tool.description ?? "").split("\n")[0]?.trim() ?? "";
  return `- \`${tool.name}\`${summary === "" ? "" : `: ${summary}`}`;
}

function readUrl(metadata: AuthorizationServerMetadata | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/** The skill's name: `mcpSkill.name`, else the card name's last segment plus `-mcp`; null when `mcpSkill` is false. */
export function getMcpSkillName(context: AgentDocumentContext): string | null {
  const setting = context.options.mcpSkill;
  return setting === false ? null : (setting.name ?? getDefaultMcpSkillName(context.options.name));
}

export function buildMcpSkill(
  context: AgentDocumentContext,
  description: McpServerDescription,
  metadata: AuthorizationServerMetadata | null,
): AgentSkill | null {
  const name = getMcpSkillName(context);
  if (name === null) return null;
  const { options, origins } = context;
  const setting = options.mcpSkill === false ? {} : options.mcpSkill;
  const summary =
    setting.description ??
    `Answer questions about a person's ${options.title} account with their own data through the remote MCP server. Use it when the person has an account and wants to connect an assistant.`;
  const endpoint = getMcpEndpointUrl(context);
  const reads = description.tools.filter((tool) => !isWriteTool(tool));
  const writes = description.tools.filter(isWriteTool);
  const issuer = readUrl(metadata, "issuer") ?? origins.appOrigin;
  const oauthLines =
    metadata === null
      ? []
      : [
          "**OAuth 2.1, for an MCP client that supports it:**",
          "",
          `- protected resource metadata: \`${getResourceMetadataUrl(origins.appOrigin, options.mcp.path)}\` (RFC 9728), authorization server: \`${issuer}${AUTHORIZATION_SERVER_METADATA_PATH}\` (RFC 8414);`,
          ...(readUrl(metadata, "registration_endpoint") === null ? [] : [`- client registration: \`POST ${readUrl(metadata, "registration_endpoint") ?? ""}\` (RFC 7591);`]),
          `- authorization: \`${readUrl(metadata, "authorization_endpoint") ?? ""}\` with PKCE \`S256\`; the person signs in and approves access;`,
          `- token: \`POST ${readUrl(metadata, "token_endpoint") ?? ""}\`; refresh tokens rotate, so keep the latest.`,
          "",
          `Step by step: ${origins.apexOrigin}${AUTH_MD_PATH}.`,
          "",
        ];
  const manualTokenPath = options.oauth?.manualTokenPath;
  const manualLines =
    manualTokenPath === undefined
      ? []
      : [`**Manual token, when a client cannot do OAuth:** the person creates one at \`${origins.appOrigin}${manualTokenPath}\` and pastes it into the client's configuration as the header value (with \`Bearer\`).`, ""];

  const body = `
# ${options.title} through MCP

${options.description}

## Connect

Endpoint: \`${endpoint}\` (MCP Streamable HTTP, \`POST\`). Every request carries \`Authorization: Bearer <token>\`; without it the server answers \`401\` with \`WWW-Authenticate\`, whose \`resource_metadata\` names the protected resource metadata.

${[...oauthLines, ...manualLines].join("\n")}
- A token belongs to one account: every answer is about that one person's data. Never ask for someone else's token or store it outside the MCP client's configuration.
- Scopes: \`${options.scopes.read}\` comes with every token; \`${options.scopes.write}\` only when the person approved writes. Without it the tools that change data are not listed at all.
- \`429\` means a rate limit: wait, do not retry in a loop.

## Tools that read

${reads.length === 0 ? "None." : reads.map(describeTool).join("\n")}

## Tools that change data

${writes.length === 0 ? "None listed for an anonymous client; they appear for a token that may write, when the deployment allows writes." : writes.map(describeTool).join("\n")}

Change data only when the person asks for it, and tell them what changed. The tool descriptions in \`tools/list\` say what each field means: read them before the first answer.

More for people: ${getServiceDocUrl(context)}
`;
  return createAgentSkill(name, summary, body);
}
