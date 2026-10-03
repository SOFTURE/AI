// POST /api/mcp: the endpoint of @softure-ai/mcp-access around the example's MCP server.
import { createMcpRoute } from "@softure-ai/mcp-access/next";
import { createServer } from "../../../lib/mcp-server.ts";

export const POST = createMcpRoute({ createServer });
