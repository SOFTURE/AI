// The MCP server card at `/.well-known/mcp/server-card.json`. Two drafts are in use, so the card carries both: the
// SEP-2127 fields (`$schema`, `name`, `version`, `remotes`; its schema is open) and the SEP-1649 fields scanners check
// (`serverInfo`, `transport`, `capabilities`, `tools`). Everything about the server comes from its own `initialize`
// and `tools/list`, so a tool added to the server appears here without an edit.
import { getAuthDocumentationUrl, getMcpEndpointUrl, type AgentDocumentContext } from "./context.js";
import { getRequiredScopes, type McpServerDescription } from "./mcp-description.js";

/** SEP-2127: the schema of the card, the value its schema requires. */
export const MCP_SERVER_CARD_SCHEMA = "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json";

/** The protocol versions the card announces when the app sets none; the SDK's list is the server-side truth. */
export interface ServerCardInput {
  readonly description: McpServerDescription;
  readonly supportedProtocolVersions: readonly string[];
}

export function buildMcpServerCard(context: AgentDocumentContext, input: ServerCardInput) {
  const { options, origins } = context;
  const endpoint = getMcpEndpointUrl(context);
  const documentation = getAuthDocumentationUrl(context);
  const { serverInfo, tools, capabilities, protocolVersion } = input.description;
  const scopes = [options.scopes.read, options.scopes.write];

  return {
    $schema: MCP_SERVER_CARD_SCHEMA,
    name: options.name,
    version: serverInfo.version,
    title: options.title,
    description: options.description,
    websiteUrl: origins.apexOrigin,
    remotes: [
      {
        type: "streamable-http",
        url: endpoint,
        headers: [
          {
            name: "Authorization",
            description: `An account token for ${options.title}.`,
            isRequired: true,
            isSecret: true,
            value: "Bearer {token}",
            variables: { token: { description: `An account token for ${options.title}.`, isRequired: true, isSecret: true } },
          },
        ],
        supportedProtocolVersions: [...input.supportedProtocolVersions],
      },
    ],
    serverInfo,
    protocolVersion,
    transport: { type: "streamable-http", endpoint },
    capabilities,
    authentication: { required: true, schemes: ["bearer"], scopes, documentation },
    documentationUrl: documentation,
    tools: tools.map((tool) => ({
      name: tool.name,
      ...(tool.title === undefined ? {} : { title: tool.title }),
      description: tool.description ?? "",
      annotations: tool.annotations ?? {},
      requiredScopes: getRequiredScopes(tool, options.scopes),
    })),
  };
}
