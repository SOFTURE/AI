// What every document builder takes: the request's origins and the module's parsed options.
import type { AgentReadyOptions } from "./options.js";
import type { AgentOrigins } from "./origins.js";
import { AUTH_MD_PATH } from "./paths.js";

export interface AgentDocumentContext {
  readonly origins: AgentOrigins;
  readonly options: AgentReadyOptions;
}

/** The MCP endpoint on the app host: the resource (RFC 8707) every token is for. */
export function getMcpEndpointUrl(context: AgentDocumentContext): string {
  return `${context.origins.appOrigin}${context.options.mcp.path}`;
}

/** The page for people about connecting an assistant, on the apex. */
export function getServiceDocUrl(context: AgentDocumentContext): string {
  return `${context.origins.apexOrigin}${context.options.serviceDoc.path}`;
}

/** The service doc's title: configured, else "Connect an AI assistant to <title>". */
export function getServiceDocTitle(context: AgentDocumentContext): string {
  return context.options.serviceDoc.title ?? `Connect an AI assistant to ${context.options.title}`;
}

/** Where an agent reads how to authenticate: auth.md with OAuth, else the service doc. */
export function getAuthDocumentationUrl(context: AgentDocumentContext): string {
  return context.options.oauth === undefined ? getServiceDocUrl(context) : `${context.origins.apexOrigin}${AUTH_MD_PATH}`;
}

/** The name agents list the MCP server under: "<title> MCP server". */
export function getMcpServerTitle(context: AgentDocumentContext): string {
  return `${context.options.title} MCP server`;
}
