// The module's options and the request's origins, resolved once per request. No `@softure-ai/core/next` here: the
// root entry loads in `next.config.ts` and `proxy.ts`.
import { getModule, resolveAppOrigin, type SoftureConfig } from "@softure-ai/core";
import { z } from "zod";
import type { AgentDocumentContext } from "./context.js";
import type { AgentReadyOptions } from "./options.js";
import { isBareOrigin } from "./options.js";
import { resolveOrigins, type OriginRequest } from "./origins.js";

export const MODULE_ID = "agent-ready";

/** The id `@softure-ai/mcp-access` registers under; read by id, so this package does not depend on it. */
export const MCP_ACCESS_MODULE_ID = "mcp-access";

/** The parts of mcp-access's parsed options discovery agrees with; other keys are ignored. */
const mcpAccessSettingsSchema = z.object({
  allowWrites: z.boolean(),
  oauth: z.object({
    enabled: z.boolean(),
    authorizationCodeLifetimeMinutes: z.int().min(1),
    accessTokenLifetimeMinutes: z.int().min(1),
    refreshTokenLifetimeDays: z.int().min(1),
  }),
});

export type McpAccessSettings = z.output<typeof mcpAccessSettingsSchema>;

/**
 * The settings of `@softure-ai/mcp-access` in `config`, or null when the module is not there. Options of another shape
 * (a version this one does not know) also answer null: discovery then keeps its own defaults.
 */
export function readMcpAccessSettings(config: SoftureConfig): McpAccessSettings | null {
  const parsed = mcpAccessSettingsSchema.safeParse(getModule(config, MCP_ACCESS_MODULE_ID)?.options);
  return parsed.success ? parsed.data : null;
}

/**
 * The options documents are built from: `oauth.lifetimes` comes from mcp-access when the app configured `oauth`
 * without them and mcp-access issues the tokens, so auth.md states what the issuer enforces.
 */
function withIssuerLifetimes(options: AgentReadyOptions, settings: McpAccessSettings | null): AgentReadyOptions {
  if (options.oauth === undefined || options.oauth.lifetimes !== undefined || settings?.oauth.enabled !== true) return options;
  const lifetimes = {
    authorizationCodeMinutes: settings.oauth.authorizationCodeLifetimeMinutes,
    accessTokenMinutes: settings.oauth.accessTokenLifetimeMinutes,
    refreshTokenDays: settings.oauth.refreshTokenLifetimeDays,
  };
  return { ...options, oauth: { ...options.oauth, lifetimes } };
}

/** The parsed options of the enabled module; throws by name when `agentReady()` is not in `modules`. */
export function getAgentReadyOptions(config: SoftureConfig): AgentReadyOptions {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/agent-ready: the agent-ready module is not enabled; add agentReady() to modules in softure.config.ts");
  }
  return module.options as AgentReadyOptions;
}

/**
 * The document context for `request`: the app origin is the `resolveAppOrigin` option's answer, else the `appOrigin`
 * option, else core `resolveAppOrigin` (a listed origin the request was sent to, see the config's `origins`, else the
 * config's `appOrigin`); the apex is the `apexOrigin` option, else the app origin. Lifetimes auth.md states come from
 * mcp-access when the app sets none. A
 * resolver that returns something other than a bare http(s) origin is a setup bug: thrown by name, never served.
 */
export function resolveDocumentContext(config: SoftureConfig, request: OriginRequest): AgentDocumentContext {
  const options = withIssuerLifetimes(getAgentReadyOptions(config), readMcpAccessSettings(config));
  const resolved = options.resolveAppOrigin === undefined ? null : options.resolveAppOrigin(request);
  if (resolved !== null && !isBareOrigin(resolved)) {
    throw new Error(`@softure-ai/agent-ready: resolveAppOrigin returned "${resolved.slice(0, 100)}", which is not an http(s) origin without a path`);
  }
  const appOrigin = resolved ?? options.appOrigin ?? resolveAppOrigin(config, request);
  return { options, origins: resolveOrigins(request, { appOrigin, apexOrigin: options.apexOrigin }) };
}
