// What the adapter hands the server functions: the registered config, the process-wide database
// handle and the wall clock.
import type { SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import type { McpOrigins } from "../origins.js";
import { createMcpAccessContext } from "../server/context.js";
import { resolveMcpOrigins } from "../server/origins.js";
import type { McpAccessContext } from "../server/tokens.js";

export function getMcpAccessContext(config: SoftureConfig = getSoftureConfig()): Promise<McpAccessContext> {
  return createMcpAccessContext(config);
}

/**
 * The origins of the request a page or a server action runs in, from Next's `headers()`: the same
 * ones the route handlers resolve, so the consent page and its decision agree.
 */
export async function getRequestOrigins(config: SoftureConfig, path: string): Promise<McpOrigins> {
  const { headers } = await import("next/headers");
  return resolveMcpOrigins(config, { url: new URL(path, config.appOrigin).toString(), headers: await headers() });
}
