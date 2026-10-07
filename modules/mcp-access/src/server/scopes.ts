// The two scopes of the MCP endpoint, shared by the Bearer check and the OAuth server.

/** Every valid token reads. */
export const MCP_READ_SCOPE = "mcp:read";
/** A token that may write: issued for writes, and the app allows them. */
export const MCP_WRITE_SCOPE = "mcp:write";
