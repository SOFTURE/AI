// The server version that follows the tool list. MCP clients keep a cached `tools/list` until the
// version they read at `initialize` changes, so a release that adds a tool or changes a schema under
// the same version leaves the assistant on the old schemas. `measureToolList` fingerprints the list
// as the client reads it, `<release>-tools-<12 hex>`: a semver prerelease, since comparisons ignore
// build metadata. The same registrations always give the same version.
import { createHash } from "node:crypto";
import { createMcpHandler, McpServer, METHOD_NOT_FOUND, type McpServerOptions, type Server } from "@modelcontextprotocol/server";

/** The release part when none is given. */
export const DEFAULT_TOOL_LIST_RELEASE = "1.0.0";

/** Hex digits of the fingerprint in the version. */
const FINGERPRINT_LENGTH = 12;
const RELEASE_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** What a client reads from `tools/list`: one entry per tool, as JSON. */
export type ServedTool = Readonly<Record<string, unknown>> & { readonly name: string };

export interface ToolListMeasurement {
  /** `<release>-tools-<12 hex>`, for `serverInfo.version`. */
  readonly toolListVersion: string;
  readonly toolCount: number;
}

/** Registers the app's tools on the server it is given, e.g. `(server) => registerNoteTools(server, identity)`. */
export type RegisterTools = (server: McpServer) => unknown;

export interface MeasureToolListOptions {
  /** The `MAJOR.MINOR.PATCH` before `-tools-`. Default: `1.0.0`. */
  readonly release?: string;
  /** The served server's name, so the recording server is shaped like it. Default: `tool-list`. */
  readonly name?: string;
  /** The served server's options (capabilities, instructions), for the same reason. */
  readonly serverOptions?: McpServerOptions;
}

/**
 * Registers the tools on a recording server shaped like the served one, lists them the way the endpoint
 * serves them and returns the version with the tool count. Any change of a tool's name, title,
 * description, annotations or input or output schema changes the version; the order of registration does not.
 */
export async function measureToolList(registerTools: RegisterTools, options: MeasureToolListOptions = {}): Promise<ToolListMeasurement> {
  const release = options.release ?? DEFAULT_TOOL_LIST_RELEASE;
  assertRelease(release);
  const server = new McpServer({ name: options.name ?? "tool-list", version: release }, options.serverOptions);
  await registerTools(server);
  return describeToolList(await listServedTools(() => server), release);
}

/** The version and count for a listed tool set. */
export function describeToolList(tools: readonly ServedTool[], release: string = DEFAULT_TOOL_LIST_RELEASE): ToolListMeasurement {
  assertRelease(release);
  return { toolListVersion: `${release}-tools-${fingerprintToolList(tools)}`, toolCount: tools.length };
}

/** The first 12 hex digits of a sha256 over the tools in name order, each as canonical JSON (keys sorted at every level). */
export function fingerprintToolList(tools: readonly ServedTool[]): string {
  const ordered = [...tools].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  return createHash("sha256").update(toCanonicalJson(ordered)).digest("hex").slice(0, FINGERPRINT_LENGTH);
}

/** Every tool a fresh server from the factory lists (none when it registered none), asked with one stateless `tools/list` as the endpoint serves it. */
export async function listServedTools(createServer: () => McpServer | Server | Promise<McpServer | Server>): Promise<ServedTool[]> {
  const handler = createMcpHandler(createServer, { responseMode: "json" });
  const response = await handler.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }),
  );
  const answer = readAnswer(await response.text());
  // A server that registered no tool declares no tools capability, so it does not know the method.
  if (answer.error?.code === METHOD_NOT_FOUND) return [];
  if (answer.result?.tools === undefined) {
    throw new Error(`@softure-ai/mcp-access: listing the server's tools failed: ${typeof answer.error?.message === "string" ? answer.error.message : `HTTP ${String(response.status)}`}`);
  }
  return answer.result.tools.filter((tool): tool is ServedTool => typeof tool.name === "string" && tool.name !== "");
}

interface ToolsListAnswer {
  readonly result?: { readonly tools?: readonly (Readonly<Record<string, unknown>> & { readonly name?: unknown })[] };
  readonly error?: { readonly code?: unknown; readonly message?: unknown };
}

/** The JSON-RPC answer, sent as JSON or as one SSE `message` event. */
function readAnswer(body: string): ToolsListAnswer {
  const data = body.startsWith("event:") ? (body.split("\n").find((line) => line.startsWith("data: "))?.slice("data: ".length) ?? "null") : body;
  return (JSON.parse(data) ?? {}) as ToolsListAnswer;
}

function toCanonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
      : entry,
  );
}

/** A release that is not `MAJOR.MINOR.PATCH` would make an invalid version: a setup bug, thrown. */
function assertRelease(release: string): void {
  if (!RELEASE_PATTERN.test(release)) {
    throw new Error(`@softure-ai/mcp-access: the tool list release must be MAJOR.MINOR.PATCH, got "${release}"`);
  }
}
