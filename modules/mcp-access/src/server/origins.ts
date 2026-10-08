// The origins of one request, from the app's options: `resolveAppOrigin` when it answers, else the
// configured `appOrigin`, plus `resourceOrigins`.
import type { SoftureConfig } from "@softure-ai/core";
import { isBareOrigin } from "../options.js";
import type { McpOriginRequest, McpOrigins } from "../origins.js";
import { getMcpAccessOptions } from "./options.js";

/**
 * The origins for `request`, or the configured ones without a request. A resolver that returns
 * something other than a bare http(s) origin is a setup bug: thrown by name, never served.
 */
export function resolveMcpOrigins(config: SoftureConfig, request?: McpOriginRequest | null): McpOrigins {
  const options = getMcpAccessOptions(config);
  const resolved = request === undefined || request === null || options.resolveAppOrigin === undefined ? null : options.resolveAppOrigin(request);
  if (resolved !== null && !isBareOrigin(resolved)) {
    throw new Error(`@softure-ai/mcp-access: resolveAppOrigin returned "${resolved.slice(0, 100)}", which is not an http(s) origin without a path`);
  }
  return { appOrigin: new URL(resolved ?? config.appOrigin).origin, resourceOrigins: options.resourceOrigins };
}
