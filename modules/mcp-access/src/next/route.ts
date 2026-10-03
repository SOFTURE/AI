// `POST /api/mcp`, built around the app's MCP server factory and mounted with one line:
// `app/api/mcp/route.ts → export const POST = createMcpRoute({ createServer });`
// The factory lives in the app, next to its tools; the module brings the rate limit, the token
// check and the identity the factory receives. GET and DELETE are not exported, so Next answers
// them with 405: the endpoint is stateless and keeps no sessions.
import { errorLogLabel } from "@softure-ai/core";
import { createMcpEndpoint, type McpEndpointOptions } from "../server/endpoint.js";
import { getMcpAccessContext } from "./context.js";

const NO_STORE = { "cache-control": "no-store" };

export function createMcpRoute(options: McpEndpointOptions): (request: Request) => Promise<Response> {
  const endpoint = createMcpEndpoint(options);
  return async (request) => {
    let ctx;
    try {
      ctx = await getMcpAccessContext();
    } catch (error) {
      console.error(`@softure-ai/mcp-access: opening the database failed: ${errorLogLabel(error)}`);
      return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: NO_STORE });
    }
    return endpoint(ctx, request);
  };
}
