// What an MCP server says about itself at `initialize` and `tools/list`: the input of both cards and the MCP skill.

export interface McpToolAnnotations {
  readonly title?: string;
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
  readonly openWorldHint?: boolean;
}

export interface McpListedTool {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly annotations?: McpToolAnnotations;
}

export interface McpServerDescription {
  readonly protocolVersion: string;
  readonly serverInfo: { readonly name: string; readonly version: string; readonly title?: string };
  readonly capabilities: Readonly<Record<string, unknown>>;
  readonly tools: readonly McpListedTool[];
}

/** Whether a tool changes data: MCP reads a missing `readOnlyHint` as "may change", so only `true` reads. */
export function isWriteTool(tool: McpListedTool): boolean {
  return tool.annotations?.readOnlyHint !== true;
}

/** The scopes a token needs to call `tool`. */
export function getRequiredScopes(tool: McpListedTool, scopes: { readonly read: string; readonly write: string }): string[] {
  return isWriteTool(tool) ? [scopes.read, scopes.write] : [scopes.read];
}
