// The Next.js adapter of @softure-ai/mcp-access: the MCP route factory, the token page and its
// server actions (docs/02-module-standard.md §8).
export { issueTokenAction, revokeTokenAction } from "./actions.js";
export { McpAccessPage } from "./pages.js";
export { createMcpRoute } from "./route.js";
