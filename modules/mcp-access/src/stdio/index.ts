// `@softure-ai/mcp-access/stdio`: the app's MCP server over stdio for a local assistant, with the
// account from the environment. `/stdio/register` lets a factory that imports `server-only` run here.
export {
  DEFAULT_MCP_USER_ID_ENV,
  serveMcpStdio,
  STDIO_TOKEN_ID,
  type McpStdioError,
  type McpStdioErrorCode,
  type McpStdioHandle,
  type McpStdioResult,
  type ServeMcpStdioOptions,
} from "./serve.js";
