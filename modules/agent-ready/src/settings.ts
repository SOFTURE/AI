// The module's options and the request's origins, resolved once per request. No `@softure-ai/core/next` here: the
// root entry loads in `next.config.ts` and `proxy.ts`.
import { getModule, resolveAppOrigin, type SoftureConfig } from "@softure-ai/core";
import type { AgentDocumentContext } from "./context.js";
import type { AgentReadyOptions } from "./options.js";
import { isBareOrigin } from "./options.js";
import { resolveOrigins, type OriginRequest } from "./origins.js";

export const MODULE_ID = "agent-ready";

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
 * config's `appOrigin`); the apex is the `apexOrigin` option, else the app origin. A
 * resolver that returns something other than a bare http(s) origin is a setup bug: thrown by name, never served.
 */
export function resolveDocumentContext(config: SoftureConfig, request: OriginRequest): AgentDocumentContext {
  const options = getAgentReadyOptions(config);
  const resolved = options.resolveAppOrigin === undefined ? null : options.resolveAppOrigin(request);
  if (resolved !== null && !isBareOrigin(resolved)) {
    throw new Error(`@softure-ai/agent-ready: resolveAppOrigin returned "${resolved.slice(0, 100)}", which is not an http(s) origin without a path`);
  }
  const appOrigin = resolved ?? options.appOrigin ?? resolveAppOrigin(config, request);
  return { options, origins: resolveOrigins(request, { appOrigin, apexOrigin: options.apexOrigin }) };
}
