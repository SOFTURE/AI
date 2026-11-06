// The `get_server_info` tool (#885): an assistant checks a "done" against production in one call. It answers the
// public facts of the ops build info route (release, commit, build and start times, the optional changelog) and the
// name and version the server answered at `initialize`, which follows the tool list. It reads no user data.
//
// With `tools: true` (#1078) it also answers the served tool contract: each tool's name, description and input schema
// as `tools/list` answers them for the caller's access level. A hosted client may keep a stale tool list for good, but
// it never caches a tool result, so the model can always read the current contract in-band.
//
// The app passes the build info reader, so `/server` never loads `@softure-ai/ops` (an optional peer):
//
//   import { readBuildInfo } from "@softure-ai/ops/server";
//   createMcpServerFactory({ name: "acme", registerTools, serverInfoTool: { buildInfo: () => readBuildInfo() } });
import type { McpServer } from "@modelcontextprotocol/server";
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import { z } from "zod";
import { en } from "../messages/en.js";
import type { McpAccessMessages } from "../messages/index.js";
import { getMcpAccessMessages } from "./options.js";
import type { ServedTool } from "./tool-list.js";
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
  /**
   * Also answers the served tool contract (`tools`), with an optional `name` input that narrows it to one tool. Turning
   * it on changes the tool's input schema, so the version changes once. Default: off.
   */
  readonly tools?: boolean;
  /**
   * The app's config: the tool's texts (`serverInfoTool` of the messages) follow its locale and overrides (#1117).
   * Default: the built-in English dictionary.
   */
  readonly config?: SoftureConfig;
  /** Default: `serverInfoTool.description` (or `descriptionWithTools`) of the messages. */
  readonly description?: string;
}

type ServerInfoToolMessages = McpAccessMessages["serverInfoTool"];

/** One served tool's contract, exactly as `tools/list` answers it. */
export interface ServedToolContract {
  readonly name: string;
  readonly description?: unknown;
  readonly inputSchema: unknown;
}

/** What `initialize` answers as `serverInfo`. */
export interface ServedServerInfo {
  readonly name: string;
  readonly version: string;
}

export interface RegisterServerInfoToolOptions extends ServerInfoToolOptions {
  /** The name and version the server answers at `initialize`; `createMcpServerFactory` passes them in. */
  readonly server: ServedServerInfo;
  /**
   * The tools the caller's `tools/list` answers, read when `tools` is on. `createMcpServerFactory` passes its measured
   * list; a hand-built server passes `() => listServedTools(createServer)` for the caller's access level.
   */
  readonly servedTools?: () => readonly ServedTool[] | Promise<readonly ServedTool[]>;
}

/** The contract part of the answer, with `tools` on. */
export interface ServerInfoToolsAnswer {
  /** Tells the model that the server's contract wins over its own copy. */
  readonly toolsHint: string;
  readonly tools: readonly ServedToolContract[];
  /** Every served tool's name, when `name` matched none. */
  readonly toolNames?: readonly string[];
}

/** The tool's answer: the served name and version, the build info and, with a provider, the changelog. */
export type ServerInfoAnswer = McpBuildInfo & { readonly server: ServedServerInfo; readonly changelog?: unknown } & Partial<ServerInfoToolsAnswer>;

/**
 * Registers `get_server_info`, read only: no input fields, or an optional `name` with `tools` on. A failing `buildInfo`
 * reaches the SDK, which answers a tool error.
 */
export function registerServerInfoTool(server: McpServer, options: RegisterServerInfoToolOptions): void {
  const annotations = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };
  const messages = options.config === undefined ? en.serverInfoTool : getMcpAccessMessages(options.config).serverInfoTool;
  const description = options.description ?? (options.tools === true ? messages.descriptionWithTools : messages.description);
  if (options.tools !== true) {
    // An empty object rather than no schema, so strict input refuses a field sent to it.
    server.registerTool(SERVER_INFO_TOOL_NAME, { description, inputSchema: z.object({}), annotations }, async () => toolResult(await readServerInfo(options)));
    return;
  }
  const readServedTools = options.servedTools;
  if (readServedTools === undefined) {
    throw new Error("@softure-ai/mcp-access: get_server_info with tools: true needs servedTools, e.g. () => listServedTools(createServer)");
  }
  server.registerTool(
    SERVER_INFO_TOOL_NAME,
    { description, inputSchema: z.object({ name: z.string().optional().describe(messages.nameInputDescription) }), annotations },
    async ({ name }) => {
      const answer = await readServerInfo(options);
      return toolResult({ ...answer, ...describeToolContract(await readServedTools(), name, messages) });
    },
  );
}

async function readServerInfo(options: RegisterServerInfoToolOptions): Promise<ServerInfoAnswer> {
  const { release, commit, builtAt, startedAt } = await options.buildInfo();
  const answer: ServerInfoAnswer = { server: { name: options.server.name, version: options.server.version }, release, commit, builtAt, startedAt };
  return options.changelog === undefined ? answer : { ...answer, changelog: await readChangelog(options.changelog) };
}

/** The contract of every served tool, or of the one named; an unknown name answers no tool and every name. */
function describeToolContract(served: readonly ServedTool[], name: string | undefined, messages: ServerInfoToolMessages): ServerInfoToolsAnswer {
  const tools = served.map((tool): ServedToolContract => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }));
  if (name === undefined) return { toolsHint: messages.toolsHint, tools };
  const named = tools.filter((tool) => tool.name === name);
  if (named.length > 0) return { toolsHint: messages.toolsHint, tools: named };
  return { toolsHint: messages.unknownToolHint, tools: [], toolNames: tools.map((tool) => tool.name).sort() };
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
