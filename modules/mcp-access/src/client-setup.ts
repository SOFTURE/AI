// Ready-to-paste MCP client setup, built around the plaintext token (FIRE_TRACKER
// `src/lib/mcp-client-config.ts`, generalised to the app's server name and URL). Pure functions:
// the issue action calls them once, while the plaintext exists.
import { formatMessage } from "@softure-ai/core";
import type { McpClientSetup } from "./contract.js";

export interface McpClientSetupInput {
  readonly serverName: string;
  readonly endpointUrl: string;
  readonly token: string;
  /** The assistant prompt template from the messages: `{serverName}` and `{command}`. */
  readonly promptTemplate: string;
}

/**
 * The `Authorization` value, with its scheme. Clients with a header field send it verbatim, and
 * the endpoint refuses a header without `Bearer `.
 */
export function getAuthorizationHeader(token: string): string {
  return `Bearer ${token.trim()}`;
}

/**
 * `claude mcp add` with the token in it, not a placeholder: the plaintext is shown once, so this
 * is the only moment a working command can be built for the user. `--scope user` connects the
 * server everywhere, not only in the folder the terminal happens to be in.
 */
export function getClaudeCodeCommand(serverName: string, endpointUrl: string, token: string): string {
  return ["claude mcp add --transport http --scope user", serverName, endpointUrl, `--header "Authorization: ${getAuthorizationHeader(token)}"`].join(" ");
}

/** The `mcpServers` block for clients configured by a file. */
export function getJsonConfig(serverName: string, endpointUrl: string, token: string): string {
  const server = { type: "http", url: endpointUrl, headers: { Authorization: getAuthorizationHeader(token) } };
  return JSON.stringify({ mcpServers: { [serverName]: server } }, null, 2);
}

/**
 * Claude Desktop's file runs local servers only, so a remote one goes through `mcp-remote`. The
 * header sits in `args` without a space (`Authorization:${AUTH_HEADER}`) and its value in `env`:
 * Claude Desktop on Windows splits arguments on spaces. `${AUTH_HEADER}` is a literal that
 * `mcp-remote` substitutes. `-y` keeps `npx` from waiting for a confirmation nobody can give.
 */
export function getDesktopConfig(serverName: string, endpointUrl: string, token: string): string {
  const server = {
    command: "npx",
    args: ["-y", "mcp-remote", endpointUrl, "--header", "Authorization:${AUTH_HEADER}"],
    env: { AUTH_HEADER: getAuthorizationHeader(token) },
  };
  return JSON.stringify({ mcpServers: { [serverName]: server } }, null, 2);
}

/** Opens Claude Code with the prompt; Claude Code shows it and waits for Enter, it runs nothing alone. */
export function getClaudeCodeLink(prompt: string): string {
  return `claude-cli://open?q=${encodeURIComponent(prompt)}`;
}

export function getMcpClientSetup({ serverName, endpointUrl, token, promptTemplate }: McpClientSetupInput): McpClientSetup {
  const claudeCodeCommand = getClaudeCodeCommand(serverName, endpointUrl, token);
  const assistantPrompt = formatMessage(promptTemplate, { serverName, command: claudeCodeCommand });
  return {
    serverName,
    endpointUrl,
    claudeCodeCommand,
    assistantPrompt,
    claudeCodeLink: getClaudeCodeLink(assistantPrompt),
    jsonConfig: getJsonConfig(serverName, endpointUrl, token),
    desktopConfig: getDesktopConfig(serverName, endpointUrl, token),
    authorizationHeader: getAuthorizationHeader(token),
  };
}
