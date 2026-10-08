// What agent discovery adds to an authorization server's documents. The token issuer (e.g. `@softure-ai/mcp-access`)
// keeps generating the metadata of its own endpoints; these keys go in through its metadata extension.
import { AUTH_MD_PATH, JWKS_PATH, PROTECTED_RESOURCE_METADATA_PATH } from "./paths.js";
import { trimOrigin } from "./origins.js";

export interface AgentAuthMetadataInput {
  /** The issuer's origin (the app host): `jwks_uri` lives there. */
  readonly appOrigin: string;
  /** The apex: auth.md and the page for people live there. */
  readonly apexOrigin: string;
  /** The issuer's dynamic client registration endpoint (RFC 7591), the same value as `registration_endpoint`. */
  readonly registrationEndpoint: string;
  /** The page for people on the apex. Default `/`. */
  readonly serviceDocPath?: string;
}

/**
 * Keys for the authorization server metadata (RFC 8414 §2): `jwks_uri` (the scanner requires one; opaque tokens
 * publish an empty set), `service_documentation`, and `agent_auth` for WorkOS auth.md discovery. `agent_auth` names
 * only `skill` and `register_uri`: listing an agentic registration method the server does not run would be false.
 */
export function buildAgentAuthMetadata(input: AgentAuthMetadataInput) {
  const app = trimOrigin(input.appOrigin);
  const apex = trimOrigin(input.apexOrigin);
  return {
    jwks_uri: `${app}${JWKS_PATH}`,
    service_documentation: `${apex}${input.serviceDocPath ?? "/"}`,
    agent_auth: { skill: `${apex}${AUTH_MD_PATH}`, register_uri: input.registrationEndpoint },
  };
}

/** Keys for the protected resource metadata (RFC 9728 §2): the page for people. */
export function buildResourceDocumentation(apexOrigin: string, serviceDocPath = "/") {
  return { resource_documentation: `${trimOrigin(apexOrigin)}${serviceDocPath}` };
}

/** A JWK Set with no keys (RFC 7517 §5): true for opaque tokens, which carry no signature to check. */
export const EMPTY_JWKS: { readonly keys: readonly never[] } = Object.freeze({ keys: Object.freeze([]) });

/**
 * The URL a `401` from the endpoint names in `WWW-Authenticate: Bearer resource_metadata="…"` (RFC 9728 §5.1): the
 * path variant of the protected resource metadata on the app host.
 */
export function getResourceMetadataUrl(appOrigin: string, mcpPath: string): string {
  return `${trimOrigin(appOrigin)}${PROTECTED_RESOURCE_METADATA_PATH}${mcpPath}`;
}

export interface AgentAuthExtensionOptions {
  /** The apex, where auth.md and the page for people live. */
  readonly apexOrigin: string;
  /** The issuer's registration route; default `/api/oauth/register` (`@softure-ai/mcp-access`). */
  readonly registerPath?: string;
  /** The page for people on the apex. Default `/`. */
  readonly serviceDocPath?: string;
}

/**
 * The function `@softure-ai/mcp-access` takes as `oauth.metadata.authorizationServer`: it gets the request's app
 * origin and adds `jwks_uri`, `service_documentation` and `agent_auth`, with `register_uri` on the same origin and
 * route as the generated `registration_endpoint`.
 */
export function createAgentAuthExtension(options: AgentAuthExtensionOptions): (origins: { readonly appOrigin: string }) => ReturnType<typeof buildAgentAuthMetadata> {
  const registerPath = options.registerPath ?? "/api/oauth/register";
  return (origins) =>
    buildAgentAuthMetadata({
      appOrigin: origins.appOrigin,
      apexOrigin: options.apexOrigin,
      registrationEndpoint: `${trimOrigin(origins.appOrigin)}${registerPath}`,
      ...(options.serviceDocPath === undefined ? {} : { serviceDocPath: options.serviceDocPath }),
    });
}
