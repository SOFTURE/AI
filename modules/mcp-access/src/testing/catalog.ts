// Catalog parity: the tools listed in softure.config.ts (the token page shows them, agent docs read
// them) against the tools the app's MCP server really registers, for a read-only and a write identity.
// Framework-free: `expectToolCatalogMatchesServer` throws, so it works in any test runner.
import type { SoftureConfig } from "@softure-ai/core";
import type { McpServerIdentity } from "../contract.js";
import type { McpServerFactory } from "../server/endpoint.js";
import { getMcpAccessOptions } from "../server/options.js";
import { describeToolList, listServedTools, type ToolListMeasurement } from "../server/tool-list.js";

export interface ToolCatalogDifferences {
  /** Configured tools the server does not register for the identity that should get them. */
  readonly missing: readonly string[];
  /** Tools the server registers that the catalog does not list. */
  readonly unlisted: readonly string[];
  /** Configured write tools the server gives a read-only identity. */
  readonly writeForReaders: readonly string[];
}

/** What `measureServedToolLists` reports: a read-only and a write identity. */
export interface ServedToolLists {
  readonly read: ToolListMeasurement;
  readonly write: ToolListMeasurement;
}

const READER: McpServerIdentity = { userId: "00000000-0000-4000-8000-000000000001", canWrite: false, tokenId: "catalog-check" };
const WRITER: McpServerIdentity = { ...READER, canWrite: true };

/** Every difference between the configured catalog and the server, each list in the catalog's order, then the server's. */
export async function getToolCatalogDifferences(config: SoftureConfig, createServer: McpServerFactory): Promise<ToolCatalogDifferences> {
  const catalog = getMcpAccessOptions(config).tools;
  const forReaders = await listServerTools(createServer, READER);
  const forWriters = await listServerTools(createServer, WRITER);
  const listed = new Set(catalog.map((tool) => tool.name));
  return {
    missing: catalog.filter((tool) => !(tool.access === "read" ? forReaders.includes(tool.name) && forWriters.includes(tool.name) : forWriters.includes(tool.name))).map((tool) => tool.name),
    unlisted: [...new Set([...forReaders, ...forWriters])].filter((name) => !listed.has(name)),
    writeForReaders: catalog.filter((tool) => tool.access === "write" && forReaders.includes(tool.name)).map((tool) => tool.name),
  };
}

/** Throws a list of every difference, e.g. in a unit test next to the server. */
export async function expectToolCatalogMatchesServer(config: SoftureConfig, createServer: McpServerFactory): Promise<void> {
  const differences = await getToolCatalogDifferences(config, createServer);
  const problems = [
    differences.missing.length > 0 ? `missing from the server: ${differences.missing.join(", ")}` : null,
    differences.unlisted.length > 0 ? `registered but not in the catalog: ${differences.unlisted.join(", ")}` : null,
    differences.writeForReaders.length > 0 ? `write tools a read-only token gets: ${differences.writeForReaders.join(", ")}` : null,
  ].filter((problem) => problem !== null);
  if (problems.length > 0) {
    throw new Error(`@softure-ai/mcp-access: the tool catalog in softure.config.ts does not match the MCP server: ${problems.join("; ")}`);
  }
}

/** The tool names a fresh server lists for the identity, asked the way the endpoint serves it. */
async function listServerTools(createServer: McpServerFactory, identity: McpServerIdentity): Promise<string[]> {
  return (await listServedTools(() => createServer(identity))).map((tool) => tool.name);
}

/** The tool list's version and count for each access level, for a snapshot that changes whenever a tool's schema does. */
export async function measureServedToolLists(createServer: McpServerFactory, release?: string): Promise<ServedToolLists> {
  return {
    read: describeToolList(await listServedTools(() => createServer(READER)), release),
    write: describeToolList(await listServedTools(() => createServer(WRITER)), release),
  };
}
