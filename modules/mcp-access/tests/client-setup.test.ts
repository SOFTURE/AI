// The setup snippets: each one carries the trimmed token with its scheme, and the server name and
// URL from the configuration.
import { getMcpClientSetup, mcpAccessMessages } from "@softure-ai/mcp-access";
import { describe, expect, it } from "vitest";

const TOKEN = `sftmcp_${"A".repeat(43)}`;
const setup = getMcpClientSetup({
  serverName: "acme",
  endpointUrl: "https://acme.example/api/mcp",
  token: ` ${TOKEN}\n`,
  promptTemplate: mcpAccessMessages.en.setup.assistantPrompt,
});

describe("getMcpClientSetup", () => {
  it("builds the Claude Code command at user scope with the token in the header", () => {
    expect(setup.claudeCodeCommand).toBe(
      `claude mcp add --transport http --scope user acme https://acme.example/api/mcp --header "Authorization: Bearer ${TOKEN}"`,
    );
  });

  it("asks the assistant to run that command and confirm the connection", () => {
    expect(setup.assistantPrompt).toBe(
      [
        "Connect to my acme account over MCP.",
        `Run: ${setup.claudeCodeCommand}`,
        'Then check /mcp and tell me whether the server "acme" is connected.',
      ].join("\n"),
    );
    expect(setup.claudeCodeLink).toBe(`claude-cli://open?q=${encodeURIComponent(setup.assistantPrompt)}`);
  });

  it("builds the mcpServers file for clients configured by a file", () => {
    expect(JSON.parse(setup.jsonConfig)).toEqual({
      mcpServers: { acme: { type: "http", url: "https://acme.example/api/mcp", headers: { Authorization: `Bearer ${TOKEN}` } } },
    });
  });

  it("bridges Claude Desktop through mcp-remote, with no space in the header argument", () => {
    expect(JSON.parse(setup.desktopConfig)).toEqual({
      mcpServers: {
        acme: {
          command: "npx",
          args: ["-y", "mcp-remote", "https://acme.example/api/mcp", "--header", "Authorization:${AUTH_HEADER}"],
          env: { AUTH_HEADER: `Bearer ${TOKEN}` },
        },
      },
    });
  });

  it("gives the header value with its scheme", () => {
    expect([setup.serverName, setup.endpointUrl, setup.authorizationHeader]).toEqual(["acme", "https://acme.example/api/mcp", `Bearer ${TOKEN}`]);
  });
});
