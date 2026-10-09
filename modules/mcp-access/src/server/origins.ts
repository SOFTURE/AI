// The origins of one request: the `resolveAppOrigin` option when it answers, else core `resolveAppOrigin` (a listed
// origin the request was sent to, see the config's `origins`, else `appOrigin`), plus `resourceOrigins`.
import { resolveAppOrigin, type SoftureConfig } from "@softure-ai/core";
import { isBareOrigin } from "../options.js";
import type { McpOriginRequest, McpOrigins } from "../origins.js";
import { getMcpAccessOptions } from "./options.js";

/**
 * The origins for `request`, or the configured ones without a request. A resolver that returns
 * something other than a bare http(s) origin is a setup bug: thrown by name, never served.
 */
export function resolveMcpOrigins(config: SoftureConfig, request?: McpOriginRequest | null): McpOrigins {
  const options = getMcpAccessOptions(config);
  if (request === undefined || request === null) return { appOrigin: config.appOrigin, resourceOrigins: options.resourceOrigins };
  const resolved = options.resolveAppOrigin === undefined ? null : options.resolveAppOrigin(request);
  if (resolved !== null && !isBareOrigin(resolved)) {
    throw new Error(`@softure-ai/mcp-access: resolveAppOrigin returned "${resolved.slice(0, 100)}", which is not an http(s) origin without a path`);
  }
  return { appOrigin: new URL(resolved ?? resolveAppOrigin(config, request)).origin, resourceOrigins: options.resourceOrigins };
}
