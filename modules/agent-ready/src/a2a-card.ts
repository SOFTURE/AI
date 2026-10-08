// The A2A agent card at `/.well-known/agent-card.json` (A2A 1.0, camelCase). The app runs an MCP server, not an A2A
// agent, so the only interface has the binding `MCP`: A2A 1.0 keeps `protocolBinding` an open string, a client that
// knows only the core bindings finds nothing to call, and one that knows MCP knows what to do. `JSONRPC` would be
// false: MCP is JSON-RPC too, but `SendMessage` would get "Method not found".
import { getAuthDocumentationUrl, getMcpEndpointUrl, type AgentDocumentContext } from "./context.js";
import { isWriteTool, type McpServerDescription } from "./mcp-description.js";

/** The binding of the card's only interface: the MCP endpoint (Streamable HTTP). */
export const A2A_MCP_BINDING = "MCP";

export function buildA2aAgentCard(context: AgentDocumentContext, description: McpServerDescription) {
  const { options, origins } = context;
  const skillTags = options.a2a.skillTags;
  return {
    name: options.title,
    description: `${options.description} Connect through the MCP server (Streamable HTTP) with an account token, not through A2A messages: the only interface has the MCP binding.`,
    version: description.serverInfo.version,
    provider: { organization: options.provider.organization, url: origins.apexOrigin },
    documentationUrl: getAuthDocumentationUrl(context),
    supportedInterfaces: [{ url: getMcpEndpointUrl(context), protocolBinding: A2A_MCP_BINDING, protocolVersion: description.protocolVersion }],
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: description.tools.map((tool) => ({
      id: tool.name,
      name: tool.title ?? tool.annotations?.title ?? tool.name,
      description: tool.description ?? "",
      tags: [isWriteTool(tool) ? "write" : "read", ...(skillTags === undefined ? [] : skillTags(tool))],
    })),
  };
}
