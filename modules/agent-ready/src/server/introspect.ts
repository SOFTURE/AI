// Reads what the app's MCP server says about itself, through the same transport a client uses: `initialize` and
// `tools/list` posted to `createMcpHandler(factory, { responseMode: "json" })`. The factory builds the server with an
// anonymous context, and no tool is called, so nothing of any account reaches a card.
import { createMcpHandler, SUPPORTED_PROTOCOL_VERSIONS, type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { McpServerDescription } from "../mcp-description.js";

const resultSchema = z.object({
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

const initializeSchema = z.object({
  protocolVersion: z.string(),
  serverInfo: z.object({ name: z.string(), version: z.string(), title: z.string().optional() }),
  capabilities: z.record(z.string(), z.unknown()),
});

const toolSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  annotations: z
    .object({
      title: z.string().optional(),
      readOnlyHint: z.boolean().optional(),
      destructiveHint: z.boolean().optional(),
      idempotentHint: z.boolean().optional(),
      openWorldHint: z.boolean().optional(),
    })
    .optional(),
});

const toolsListSchema = z.object({ tools: z.array(toolSchema), nextCursor: z.string().optional() });

/** The SDK's protocol versions, newest first: what the server card announces when the app sets none. */
export const SDK_PROTOCOL_VERSIONS: readonly string[] = [...SUPPORTED_PROTOCOL_VERSIONS];

/**
 * The JSON-RPC result of one reply. Requests of the 2025 protocol era get SSE (`event: message` / `data: …`) even with
 * `responseMode: "json"`, so the reply is plain JSON or the last `data:` line of the stream.
 */
export function readJsonRpcResult(status: number, body: string, method: string): Record<string, unknown> {
  const dataLines = body
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());
  const payload = dataLines.at(-1) ?? body;
  let parsed: z.infer<typeof resultSchema>;
  try {
    parsed = resultSchema.parse(JSON.parse(payload));
  } catch {
    throw new Error(`MCP ${method} for discovery: HTTP ${status}, the reply is not JSON-RPC`);
  }
  if (status >= 400 || parsed.result === undefined) {
    throw new Error(`MCP ${method} for discovery: HTTP ${status}, ${parsed.error?.message ?? "no result"}`);
  }
  return parsed.result;
}

export interface ReadServerDescriptionOptions {
  /** The endpoint path the request is addressed to; the handler does not route by it. Default `/api/mcp`. */
  readonly path?: string;
  /** The version sent in `initialize`. Default: the SDK's newest. */
  readonly protocolVersion?: string;
}

/** `initialize`, then every page of `tools/list`, of a server built by `factory`. Throws when the server does not answer. */
export async function readServerDescription(
  factory: () => unknown,
  options: ReadServerDescriptionOptions = {},
): Promise<McpServerDescription> {
  // The factory is the app's: typed loosely in the options so the root entry does not import the SDK.
  const handler = createMcpHandler(async () => (await factory()) as McpServer, { responseMode: "json" });
  let id = 0;
  const ask = async (method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> => {
    id += 1;
    const response = await handler.fetch(
      new Request(`http://discovery.invalid${options.path ?? "/api/mcp"}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }),
      }),
    );
    return readJsonRpcResult(response.status, await response.text(), method);
  };

  const init = initializeSchema.parse(
    await ask("initialize", {
      protocolVersion: options.protocolVersion ?? SDK_PROTOCOL_VERSIONS[0],
      capabilities: {},
      clientInfo: { name: "agent-ready-discovery", version: "1.0.0" },
    }),
  );
  const tools: z.infer<typeof toolSchema>[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 50; page += 1) {
    const listed = toolsListSchema.parse(await ask("tools/list", cursor === undefined ? undefined : { cursor }));
    tools.push(...listed.tools);
    cursor = listed.nextCursor;
    if (cursor === undefined) break;
  }
  return { protocolVersion: init.protocolVersion, serverInfo: init.serverInfo, capabilities: init.capabilities, tools };
}
