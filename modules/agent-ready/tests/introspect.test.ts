// MCP introspection: what the cards read from the app's server, through the transport a client uses.
import { McpServer } from "@modelcontextprotocol/server";
import { readJsonRpcResult, readServerDescription, SDK_PROTOCOL_VERSIONS } from "@softure-ai/agent-ready/server";
import { describe, expect, it } from "vitest";
import { createDemoServer } from "./support.js";

describe("readServerDescription", () => {
  it("reads initialize and tools/list of a real server", async () => {
    const description = await readServerDescription(() => createDemoServer());
    expect(description.serverInfo).toEqual({ name: "example", version: "2.4.0" });
    expect(SDK_PROTOCOL_VERSIONS).toContain(description.protocolVersion);
    expect(description.capabilities).toHaveProperty("tools");
    expect(description.tools.map((tool) => tool.name)).toEqual(["get_summary", "add_note"]);
    expect(description.tools[0]?.annotations).toEqual({ readOnlyHint: true });
  });

  it("follows the server: a tool added to it appears without another edit", async () => {
    const description = await readServerDescription(async () => Promise.resolve(createDemoServer(["get_history"])));
    expect(description.tools.map((tool) => tool.name)).toEqual(["get_summary", "add_note", "get_history"]);
  });

  it("negotiates the configured protocol version", async () => {
    const oldest = SDK_PROTOCOL_VERSIONS.at(-1) ?? "";
    expect((await readServerDescription(() => createDemoServer(), { protocolVersion: oldest })).protocolVersion).toBe(oldest);
  });

  it("throws by name when the factory fails", async () => {
    await expect(
      readServerDescription(() => {
        throw new Error("no database");
      }),
    ).rejects.toThrow();
    await expect(readServerDescription(() => new McpServer({ name: "empty", version: "1.0.0" }))).rejects.toThrow("MCP tools/list for discovery");
  });
});

describe("readJsonRpcResult", () => {
  it("reads plain JSON and the last data line of an SSE stream", () => {
    expect(readJsonRpcResult(200, '{"jsonrpc":"2.0","id":1,"result":{"a":1}}', "x")).toEqual({ a: 1 });
    expect(readJsonRpcResult(200, 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"b":2}}\n\n', "x")).toEqual({ b: 2 });
  });

  it("names the method on an error, a missing result or a body that is not JSON-RPC", () => {
    expect(() => readJsonRpcResult(400, '{"jsonrpc":"2.0","id":1,"error":{"message":"bad"}}', "initialize")).toThrow("MCP initialize for discovery: HTTP 400, bad");
    expect(() => readJsonRpcResult(200, "<html>", "tools/list")).toThrow("MCP tools/list for discovery: HTTP 200, the reply is not JSON-RPC");
  });
});
