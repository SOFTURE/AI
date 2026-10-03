// The mcp-access options of the running app, read from the configuration in the module context.
import { getModule, type Locale, type SoftureConfig } from "@softure-ai/core";
import type { McpAccessMessages } from "../messages/index.js";
import type { McpAccessOptions } from "../options.js";

const MODULE_ID = "mcp-access";

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getMcpAccessModule(config: SoftureConfig) {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/mcp-access: the module is not enabled; add mcpAccess({ ... }) to modules in softure.config.ts");
  }
  return module;
}

export function getMcpAccessOptions(config: SoftureConfig): McpAccessOptions {
  // The module factory parsed these options with mcpAccessOptionsSchema.
  return getMcpAccessModule(config).options as McpAccessOptions;
}

export interface McpAccessRoutes {
  /** The token page. */
  readonly page: string;
  /** `POST` MCP endpoint. */
  readonly endpoint: string;
}

export function getMcpAccessRoutes(config: SoftureConfig): McpAccessRoutes {
  const routes = getMcpAccessModule(config).routes;
  const read = (name: keyof McpAccessRoutes): string => {
    const path = routes[name];
    // The manifest declares every route, so a missing one means a broken module definition.
    if (path === undefined) throw new Error(`@softure-ai/mcp-access: route "${name}" is missing from the module manifest`);
    return path;
  };
  return { page: read("page"), endpoint: read("endpoint") };
}

/** The absolute URL MCP clients call: the app's origin and the endpoint route. */
export function getMcpEndpointUrl(config: SoftureConfig): string {
  return new URL(getMcpAccessRoutes(config).endpoint, config.appOrigin).toString();
}

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getMcpAccessMessages(config: SoftureConfig): McpAccessMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getMcpAccessModule(config).messages[config.locale] as McpAccessMessages;
}

/** The text in `locale`, else in `en`. */
export function getLocalizedText(text: Partial<Record<Locale, string>>, locale: Locale): string {
  return text[locale] ?? text.en ?? "";
}
