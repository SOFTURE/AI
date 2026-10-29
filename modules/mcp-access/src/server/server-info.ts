// The `get_server_info` tool (#885): an assistant checks a "done" against production in one call. It answers the
// public facts of the ops build info route (release, commit, build and start times, the optional changelog) and the
// name and version the server answered at `initialize`, which follows the tool list. It reads no user data.
//
// The app passes the build info reader, so `/server` never loads `@softure-ai/ops` (an optional peer):
//
//   import { readBuildInfo } from "@softure-ai/ops/server";
//   createMcpServerFactory({ name: "acme", registerTools, serverInfoTool: { buildInfo: () => readBuildInfo() } });
import type { McpServer } from "@modelcontextprotocol/server";
import { errorLogLabel } from "@softure-ai/core";
import { z } from "zod";
import { en } from "../messages/en.js";
import { toolResult } from "./tools.js";

export const SERVER_INFO_TOOL_NAME = "get_server_info";

/** The build info of `@softure-ai/ops` (`readBuildInfo()`), typed by shape so mcp-access does not import ops. */
export interface McpBuildInfo {
  readonly release: string | null;
  readonly commit: string | null;
  readonly builtAt: string | null;
  readonly startedAt: string;
}

export interface ServerInfoToolOptions {
  /** The build info, e.g. `() => readBuildInfo()` from `@softure-ai/ops/server` with the route's options. */
  readonly buildInfo: () => McpBuildInfo | Promise<McpBuildInfo>;
  /** The changelog the build info route answers, when the app passes one there. Only what is public. */
  readonly changelog?: () => unknown;
  /** Default: `serverInfoTool.description` of the module dictionary. */
  readonly description?: string;
}

/** What `initialize` answers as `serverInfo`. */
export interface ServedServerInfo {
  readonly name: string;
  readonly version: string;
}

export interface RegisterServerInfoToolOptions extends ServerInfoToolOptions {
  /** The name and version the server answers at `initialize`; `createMcpServerFactory` passes them in. */
  readonly server: ServedServerInfo;
}

/** The tool's answer: the served name and version, the build info and, with a provider, the changelog. */
export type ServerInfoAnswer = McpBuildInfo & { readonly server: ServedServerInfo; readonly changelog?: unknown };

/** Registers `get_server_info`: no input fields, read only. A failing `buildInfo` reaches the SDK, which answers a tool error. */
export function registerServerInfoTool(server: McpServer, options: RegisterServerInfoToolOptions): void {
  server.registerTool(
    SERVER_INFO_TOOL_NAME,
    {
      description: options.description ?? en.serverInfoTool.description,
      // An empty object rather than no schema, so strict input refuses a field sent to it.
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => toolResult(await readServerInfo(options)),
  );
}

async function readServerInfo(options: RegisterServerInfoToolOptions): Promise<ServerInfoAnswer> {
  const { release, commit, builtAt, startedAt } = await options.buildInfo();
  const answer: ServerInfoAnswer = { server: { name: options.server.name, version: options.server.version }, release, commit, builtAt, startedAt };
  return options.changelog === undefined ? answer : { ...answer, changelog: await readChangelog(options.changelog) };
}

/** As the build info route: a failing provider answers `null` and logs the error class, so the build info still answers. */
async function readChangelog(provider: () => unknown): Promise<unknown> {
  try {
    return (await provider()) ?? null;
  } catch (error) {
    console.error(`get_server_info: the changelog provider failed: ${errorLogLabel(error)}`);
    return null;
  }
}
