// The app's MCP server factory with a version that follows its tool list. The tools are measured once
// per access level (a read-only token sees fewer tools) on a recording server, and each request's
// server answers `initialize` with that level's version, so a client drops its cached `tools/list`
// whenever a release changes a tool. The factory plugs into `createMcpEndpoint`, `serveMcpStdio` and
// the catalog check like a hand-written one.
//
//   export const createServer = createMcpServerFactory({
//     name: "acme",
//     registerTools: (server, identity) => registerNoteTools(server, identity),
//   });
import { McpServer, type McpServerOptions } from "@modelcontextprotocol/server";
import type { McpServerIdentity } from "../contract.js";
import type { McpServerFactory } from "./endpoint.js";
import { measureToolList, type ToolListMeasurement } from "./tool-list.js";

export interface McpServerFactoryOptions {
  /** `serverInfo.name`. */
  readonly name: string;
  /** `serverInfo.title`, the name a client shows. */
  readonly title?: string;
  /** The `MAJOR.MINOR.PATCH` before `-tools-`. Default: `1.0.0`. */
  readonly release?: string;
  /** A fixed `serverInfo.version` instead of the measured one. */
  readonly version?: string;
  readonly serverOptions?: McpServerOptions;
  /**
   * Registers the tools for one request. The tool list may depend on `identity.canWrite` only: it is
   * measured once per access level. A list that depends on the account needs `measureToolList` per call.
   */
  readonly registerTools: (server: McpServer, identity: McpServerIdentity) => unknown;
}

/** An `McpServerFactory` whose servers carry the tool list's version for the identity's access level. */
export function createMcpServerFactory(options: McpServerFactoryOptions): McpServerFactory {
  const measurements = new Map<boolean, Promise<ToolListMeasurement>>();

  // The promise is cached, so parallel first requests measure once; a failed measurement is dropped so
  // the next request tries again instead of failing for good.
  const measure = (identity: McpServerIdentity): Promise<ToolListMeasurement> => {
    const cached = measurements.get(identity.canWrite);
    if (cached !== undefined) return cached;
    const measurement = measureToolList((server) => options.registerTools(server, identity), {
      ...(options.release === undefined ? {} : { release: options.release }),
      name: options.name,
      ...(options.serverOptions === undefined ? {} : { serverOptions: options.serverOptions }),
    });
    measurements.set(identity.canWrite, measurement);
    void measurement.catch(() => measurements.delete(identity.canWrite));
    return measurement;
  };

  return async (identity) => {
    const version = options.version ?? (await measure(identity)).toolListVersion;
    const server = new McpServer(
      { name: options.name, version, ...(options.title === undefined ? {} : { title: options.title }) },
      options.serverOptions,
    );
    await options.registerTools(server, identity);
    return server;
  };
}
