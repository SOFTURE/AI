// The OAuth 2.1 authorization server's HTTP layer: discovery metadata (RFC 8414, RFC 9728),
// dynamic client registration (RFC 7591), the authorization request and the consent decision
// (RFC 6749 §4.1, PKCE, RFC 9207 `iss`), and the token endpoint with rotated refresh tokens. Each
// handler takes a Web `Request` and returns a `Response`, so any fetch-shaped host can mount it;
// the Next adapter only supplies the context and the session.
import { errorLogLabel, getModule, type SoftureConfig } from "@softure-ai/core";
import { readSmallBody, type ReadSmallBodyResult } from "@softure-ai/security";
import { consumeRateLimit, identifyClient } from "@softure-ai/security/server";
import type { McpMetadataExtension } from "../options.js";
import { findServedResourceOrigin, type McpOriginRequest, type McpOrigins } from "../origins.js";
import type { OAuthClientRow } from "../schema.js";
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "./scopes.js";
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  findOAuthClient,
  isClientSecretValid,
  refreshMcpGrant,
  registerMcpClient,
  type IssuedOAuthTokens,
} from "./oauth.js";
import { parseClientRegistration } from "./oauth-validation.js";
import { getMcpAccessOptions, getMcpAccessRoutes, getMcpEndpointUrl } from "./options.js";
import { resolveMcpOrigins } from "./origins.js";
import { isValidCodeChallenge, PKCE_METHOD } from "./pkce.js";
import type { McpAccessContext } from "./tokens.js";

/** The security bucket OAuth registration and token requests count in. */
export const MCP_OAUTH_RATE_LIMIT_BUCKET = "mcp-oauth";

/** RFC 8414 §3: the authorization server metadata, at the root of the issuer. */
export const AUTHORIZATION_SERVER_METADATA_PATH = "/.well-known/oauth-authorization-server";
/** RFC 9728 §3: protected resource metadata; the endpoint's own variant appends its path. */
export const PROTECTED_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";

export const OAUTH_SCOPES = [MCP_READ_SCOPE, MCP_WRITE_SCOPE] as const;

/** The parameters the consent form carries to the decision in hidden fields. */
export const AUTHORIZATION_PARAMS = ["response_type", "client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "resource"] as const;

/** Values longer than this are not echoed into a form or a redirect. */
const MAX_PARAM_LENGTH = 2048;

/**
 * CORS `*` is safe on these routes because none reads a cookie: registration and token
 * authenticate the client by what it sent. A browser-based MCP client cannot sign in without it.
 */
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
};
/** Responses that carry credentials must not be stored (RFC 6749 §5.1). */
const NO_STORE = { "cache-control": "no-store", pragma: "no-cache" };
/** Discovery documents change only with a deploy, and with the host they were asked on. */
const DISCOVERY_CACHE = { "cache-control": "public, max-age=300", vary: "host, x-forwarded-proto" };

function protocolJson(body: unknown, status = 200, extra: Readonly<Record<string, string>> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, ...NO_STORE, ...extra } });
}

/** An error in the shape of RFC 6749 §5.2 / RFC 7591 §3.2.2. */
function protocolError(error: string, description: string, status = 400, extra: Readonly<Record<string, string>> = {}): Response {
  return protocolJson({ error, error_description: description }, status, extra);
}

/** `OPTIONS` on the registration, token and discovery routes. */
export function answerOAuthPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ---------------------------------------------------------------------------------------------
// Discovery

/**
 * The issuer: the app's origin, without a path or a trailing slash. `origins` are the request's
 * (`resolveMcpOrigins`); without them, the configured `appOrigin`.
 */
export function getOAuthIssuer(config: SoftureConfig, origins: McpOrigins = resolveMcpOrigins(config)): string {
  return origins.appOrigin;
}

/** The URL the endpoint's `401` names in `resource_metadata` (RFC 9728 §5.1). */
export function getProtectedResourceMetadataUrl(config: SoftureConfig, origins: McpOrigins = resolveMcpOrigins(config)): string {
  return `${getOAuthIssuer(config, origins)}${PROTECTED_RESOURCE_METADATA_PATH}${new URL(getMcpEndpointUrl(config, origins)).pathname}`;
}

/** Whether the app turned OAuth on; the OAuth routes answer 404 otherwise. */
export function isOAuthEnabled(config: SoftureConfig): boolean {
  return getMcpAccessOptions(config).oauth.enabled;
}

/** The app's extra keys under the generated ones (`oauth.metadata`). */
function readExtension(extension: McpMetadataExtension | undefined, origins: McpOrigins): Readonly<Record<string, unknown>> {
  if (extension === undefined) return {};
  return typeof extension === "function" ? extension(origins) : extension;
}

/**
 * Authorization server metadata (RFC 8414 §2), with the app's `oauth.metadata.authorizationServer`
 * keys added; generated keys win. Tokens are opaque: no OpenID.
 */
export function getAuthorizationServerMetadata(config: SoftureConfig, origins: McpOrigins = resolveMcpOrigins(config)) {
  const issuer = getOAuthIssuer(config, origins);
  const routes = getMcpAccessRoutes(config);
  return {
    ...readExtension(getMcpAccessOptions(config).oauth.metadata.authorizationServer, origins),
    issuer,
    authorization_endpoint: `${issuer}${routes.oauthConsent}`,
    token_endpoint: `${issuer}${routes.oauthToken}`,
    registration_endpoint: `${issuer}${routes.oauthRegister}`,
    scopes_supported: [...OAUTH_SCOPES],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    // MCP clients refuse an authorization server that does not list S256.
    code_challenge_methods_supported: [PKCE_METHOD],
    authorization_response_iss_parameter_supported: true,
  };
}

/**
 * Protected resource metadata (RFC 9728 §2), with the app's `oauth.metadata.protectedResource`
 * keys added; generated keys win, except the app's `resource_name`. At the endpoint's own path the
 * resource is the endpoint URL; at the root it is the origin the document was asked on
 * (`servedOrigin`, one of `resourceOrigins`) or else the app origin, because RFC 9728 §3.3 ties
 * `resource` to the URL the metadata URL was built from.
 */
export function getProtectedResourceMetadata(
  config: SoftureConfig,
  variant: "endpoint" | "root",
  origins: McpOrigins = resolveMcpOrigins(config),
  servedOrigin: string | null = null,
) {
  const issuer = getOAuthIssuer(config, origins);
  return {
    resource_name: getMcpAccessOptions(config).serverName,
    ...readExtension(getMcpAccessOptions(config).oauth.metadata.protectedResource, origins),
    resource: variant === "endpoint" ? getMcpEndpointUrl(config, origins) : (servedOrigin ?? issuer),
    authorization_servers: [issuer],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
  };
}

/** Builds a discovery document for the request's origins; the request is null outside a route. */
export type DiscoveryDocument = (config: SoftureConfig, origins: McpOrigins, request: McpOriginRequest | null) => unknown;

/** `GET` of a discovery document for `request` (its origins); 404 while OAuth is off. */
export function serveDiscoveryDocument(config: SoftureConfig, document: DiscoveryDocument, request: McpOriginRequest | null = null): Response {
  if (!isOAuthEnabled(config)) return Response.json({ error: "not_found" }, { status: 404, headers: CORS_HEADERS });
  return Response.json(document(config, resolveMcpOrigins(config, request), request), { headers: { ...CORS_HEADERS, ...DISCOVERY_CACHE } });
}

/** `serveDiscoveryDocument`'s builder for the root protected resource metadata, on the host it was asked on. */
export const getRootProtectedResourceMetadata: DiscoveryDocument = (config, origins, request) =>
  getProtectedResourceMetadata(config, "root", origins, request === null ? null : findServedResourceOrigin(origins, request));

/**
 * Whether `resource` (RFC 8707) names this server: absent (clients from before RFC 8707), the
 * endpoint URL, the app origin or one of `resourceOrigins`, each with or without a trailing slash.
 */
export function isAcceptableResource(config: SoftureConfig, resource: string | null, origins: McpOrigins = resolveMcpOrigins(config)): boolean {
  if (resource === null || resource === "") return true;
  const endpoint = getMcpEndpointUrl(config, origins).replace(/\/+$/, "");
  return [endpoint, getOAuthIssuer(config, origins), ...origins.resourceOrigins].some((accepted) => resource === accepted || resource === `${accepted}/`);
}

/** Whether the client asks to write. Unknown scopes are ignored (RFC 6749 §3.3); every grant reads. */
export function isWriteScopeRequested(scope: string | null): boolean {
  return (scope ?? "").split(/\s+/).includes(MCP_WRITE_SCOPE);
}

// ---------------------------------------------------------------------------------------------
// Rate limit

/** A missing bucket is a setup bug: thrown, so it reaches the log by name instead of a quiet 503. */
function assertOAuthRateLimitBucket(config: SoftureConfig): void {
  const options = getModule(config, "security")?.options as { buckets?: Record<string, unknown> } | undefined;
  if (options?.buckets?.[MCP_OAUTH_RATE_LIMIT_BUCKET] === undefined) {
    throw new Error(
      `@softure-ai/mcp-access: the security module has no "${MCP_OAUTH_RATE_LIMIT_BUCKET}" bucket; spread MCP_RATE_LIMIT_BUCKETS into security({ buckets })`,
    );
  }
}

/**
 * Counts the request in the OAuth bucket before any work: per client address, and for the token
 * endpoint per address and client id (an assistant platform refreshes the tokens of all its users
 * from a few shared addresses, and each connection registers its own client). A failing counter
 * closes (503) and says nothing.
 */
async function limitProtocolRequest(ctx: McpAccessContext, request: Request, clientId: string | null = null): Promise<Response | null> {
  assertOAuthRateLimitBucket(ctx.config);
  const client = identifyClient(ctx, request.headers);
  if (!client.ok) return protocolError("invalid_request", "The client address could not be identified.", 400);
  const key = clientId === null ? client.value : `${client.value}|${clientId.slice(0, 64)}`;
  try {
    const limit = await consumeRateLimit(ctx, { bucket: MCP_OAUTH_RATE_LIMIT_BUCKET, key });
    if (limit.ok) return null;
    return protocolError("too_many_requests", "Too many requests; try again later.", 429, { "retry-after": String(limit.retryAfterSeconds) });
  } catch (error) {
    console.error(`@softure-ai/mcp-access: counting an OAuth request failed: ${errorLogLabel(error)}`);
    return protocolError("temporarily_unavailable", "The server is temporarily unavailable.", 503);
  }
}

// ---------------------------------------------------------------------------------------------
// Request bodies

/** The body as text, read up to `oauth.maxBodyBytes`: registration and token are public, so the cap comes before any parsing. */
function readCappedBody(config: SoftureConfig, request: Request): Promise<ReadSmallBodyResult> {
  return readSmallBody(request, { maxBytes: getMcpAccessOptions(config).oauth.maxBodyBytes });
}

function bodyTooLarge(config: SoftureConfig): Response {
  return protocolError("invalid_request", `The request body is larger than ${String(getMcpAccessOptions(config).oauth.maxBodyBytes)} bytes.`, 413);
}

// ---------------------------------------------------------------------------------------------
// Registration

/**
 * `POST` dynamic client registration (RFC 7591). Public by definition: claude.ai and ChatGPT
 * register before anyone signs in. A registration grants nothing; access needs a person's consent.
 */
export async function handleClientRegistration(ctx: McpAccessContext, request: Request): Promise<Response> {
  if (!isOAuthEnabled(ctx.config)) return protocolError("not_found", "OAuth is not enabled.", 404);
  const limited = await limitProtocolRequest(ctx, request);
  if (limited !== null) return limited;

  const notJson = () => protocolError("invalid_client_metadata", "The request body must be a JSON object.");
  const text = await readCappedBody(ctx.config, request);
  if (!text.ok) return text.error === "security.body_too_large" ? bodyTooLarge(ctx.config) : notJson();
  let body: unknown;
  try {
    body = JSON.parse(text.value);
  } catch {
    return notJson();
  }
  const parsed = parseClientRegistration(body);
  if (!parsed.ok) return protocolError(parsed.error.error, parsed.error.description);

  try {
    const { client, clientSecret } = await registerMcpClient(ctx, parsed.value);
    return protocolJson(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        ...(clientSecret === null ? {} : { client_secret: clientSecret, client_secret_expires_at: 0 }),
      },
      201,
    );
  } catch (error) {
    console.error(`@softure-ai/mcp-access: registering an OAuth client failed: ${errorLogLabel(error)}`);
    return protocolError("server_error", "The client could not be registered.", 500);
  }
}

// ---------------------------------------------------------------------------------------------
// Token endpoint

interface ClientCredentials {
  readonly clientId: string | null;
  readonly clientSecret: string | null;
  readonly isBasic: boolean;
}

/** `Basic` (RFC 6749 §2.3.1: both parts form-urlencoded) or the body fields; a public client sends its id only. */
function readClientCredentials(request: Request, form: URLSearchParams): ClientCredentials {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("basic ") === true) {
    try {
      const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator > 0) {
        const decode = (part: string) => decodeURIComponent(part.replace(/\+/g, " "));
        return { clientId: decode(decoded.slice(0, separator)), clientSecret: decode(decoded.slice(separator + 1)), isBasic: true };
      }
    } catch {
      // A broken header is no credentials; the caller refuses.
    }
    return { clientId: null, clientSecret: null, isBasic: true };
  }
  return { clientId: form.get("client_id"), clientSecret: form.get("client_secret"), isBasic: false };
}

function tokenResponse(tokens: IssuedOAuthTokens): Response {
  return protocolJson({
    access_token: tokens.accessToken,
    token_type: "Bearer",
    expires_in: tokens.expiresIn,
    refresh_token: tokens.refreshToken,
    scope: tokens.canWrite ? `${MCP_READ_SCOPE} ${MCP_WRITE_SCOPE}` : MCP_READ_SCOPE,
  });
}

/** One answer for every refused code or refresh token: the client restarts either way. */
const INVALID_GRANT = "The code or refresh token is invalid, expired, used or issued to another client.";

/**
 * `POST` token endpoint (RFC 6749 §3.2): a code with its PKCE verifier, or a refresh token with
 * rotation. Secrets come in the body, never in the URL.
 */
export async function handleTokenRequest(ctx: McpAccessContext, request: Request): Promise<Response> {
  if (!isOAuthEnabled(ctx.config)) return protocolError("not_found", "OAuth is not enabled.", 404);
  const origins = resolveMcpOrigins(ctx.config, request);
  const text = await readCappedBody(ctx.config, request);
  if (!text.ok && text.error === "security.body_too_large") {
    // Counted by address alone: the client id inside an oversized body is never read.
    return (await limitProtocolRequest(ctx, request)) ?? bodyTooLarge(ctx.config);
  }
  // An unreadable body is an empty form, which the client check refuses.
  const form = new URLSearchParams(text.ok ? text.value : "");
  const credentials = readClientCredentials(request, form);
  const limited = await limitProtocolRequest(ctx, request, credentials.clientId);
  if (limited !== null) return limited;

  try {
    const client = credentials.clientId === null ? null : await findOAuthClient(ctx, credentials.clientId);
    if (client === null || !isClientSecretValid(client, credentials.clientSecret === "" ? null : credentials.clientSecret)) {
      return protocolError("invalid_client", "Unknown client or wrong client credentials.", 401, credentials.isBasic ? { "www-authenticate": 'Basic realm="mcp"' } : {});
    }
    return await answerGrant(ctx, { form, client, origins });
  } catch (error) {
    console.error(`@softure-ai/mcp-access: the OAuth token endpoint failed: ${errorLogLabel(error)}`);
    return protocolError("server_error", "The token could not be issued.", 500);
  }
}

interface GrantRequest {
  readonly form: URLSearchParams;
  readonly client: OAuthClientRow;
  readonly origins: McpOrigins;
}

async function answerGrant(ctx: McpAccessContext, { form, client, origins }: GrantRequest): Promise<Response> {
  if (!isAcceptableResource(ctx.config, form.get("resource"), origins)) {
    return protocolError("invalid_target", "The resource parameter does not name this MCP server.");
  }
  const grantType = form.get("grant_type");
  if (grantType === "authorization_code") {
    const code = form.get("code");
    const codeVerifier = form.get("code_verifier");
    if (code === null || code === "" || codeVerifier === null || codeVerifier === "") {
      return protocolError("invalid_request", "code and code_verifier (PKCE) are required.");
    }
    // A missing redirect_uri is allowed when the client registered exactly one (RFC 6749 §4.1.3).
    const tokens = await exchangeAuthorizationCode(ctx, { code, client, redirectUri: form.get("redirect_uri"), codeVerifier });
    return tokens === null ? protocolError("invalid_grant", INVALID_GRANT) : tokenResponse(tokens);
  }
  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token");
    if (refreshToken === null || refreshToken === "") return protocolError("invalid_request", "refresh_token is required.");
    const tokens = await refreshMcpGrant(ctx, { refreshToken, client });
    return tokens === null ? protocolError("invalid_grant", INVALID_GRANT) : tokenResponse(tokens);
  }
  return protocolError("unsupported_grant_type", "Supported grant types: authorization_code and refresh_token.");
}

// ---------------------------------------------------------------------------------------------
// Authorization request and decision

export interface AuthorizationRequest {
  readonly client: OAuthClientRow;
  readonly redirectUri: string;
  readonly state: string | null;
  readonly codeChallenge: string;
  /** The client asked for `mcp:write`. */
  readonly isWriteRequested: boolean;
}

/** Why the consent page shows an error instead of sending one back: the client is not confirmed. */
export type AuthorizationPageError = "unknown_client" | "redirect_mismatch";

export type AuthorizationOutcome =
  | { readonly kind: "show-error"; readonly reason: AuthorizationPageError }
  | { readonly kind: "redirect-error"; readonly location: string; readonly redirectUri: string }
  | { readonly kind: "valid"; readonly request: AuthorizationRequest };

/**
 * The client's redirect URI with parameters added, keeping the query it registered (RFC 6749
 * §3.1.2), and always `iss` (RFC 9207), so the client knows the answer came from this server.
 */
export function buildClientRedirect(
  config: SoftureConfig,
  redirectUri: string,
  params: Readonly<Record<string, string | null>>,
  origins: McpOrigins = resolveMcpOrigins(config),
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries({ ...params, iss: getOAuthIssuer(config, origins) })) {
    if (value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}

/** The authorization parameters of a query string or form, each at most 2048 characters. */
export function readAuthorizationParams(source: { get(name: string): unknown }): URLSearchParams {
  const params = new URLSearchParams();
  for (const name of AUTHORIZATION_PARAMS) {
    const value = source.get(name);
    if (typeof value === "string" && value.length <= MAX_PARAM_LENGTH) params.set(name, value);
  }
  return params;
}

/**
 * Validates an authorization request (RFC 6749 §4.1.1), for the consent page and the decision.
 * Order is a security rule (RFC 6749 §4.1.2.1): until the client and its redirect URI are
 * confirmed, an error is shown to the person, never redirected, or the server would redirect
 * anyone anywhere. Only then do errors go back to the client. `origins` are the request's
 * (the consent page's and the decision's must agree); without them, the configured ones.
 */
export async function validateAuthorizationRequest(
  ctx: McpAccessContext,
  params: URLSearchParams,
  origins: McpOrigins = resolveMcpOrigins(ctx.config),
): Promise<AuthorizationOutcome> {
  const clientId = params.get("client_id");
  const client = clientId === null ? null : await findOAuthClient(ctx, clientId);
  if (client === null) return { kind: "show-error", reason: "unknown_client" };

  const redirectUri = params.get("redirect_uri") ?? (client.redirectUris.length === 1 ? (client.redirectUris[0] ?? null) : null);
  if (redirectUri === null || !client.redirectUris.includes(redirectUri)) return { kind: "show-error", reason: "redirect_mismatch" };

  const state = params.get("state");
  const back = (error: string, description: string): AuthorizationOutcome => ({
    kind: "redirect-error",
    redirectUri,
    location: buildClientRedirect(ctx.config, redirectUri, { error, error_description: description, state }, origins),
  });
  if (params.get("response_type") !== "code") return back("unsupported_response_type", "Only response_type=code is supported.");
  const codeChallenge = params.get("code_challenge");
  if (codeChallenge === null || !isValidCodeChallenge(codeChallenge) || params.get("code_challenge_method") !== PKCE_METHOD) {
    return back("invalid_request", "PKCE is required: code_challenge with code_challenge_method S256.");
  }
  if (!isAcceptableResource(ctx.config, params.get("resource"), origins)) return back("invalid_target", "The resource parameter does not name this MCP server.");
  return { kind: "valid", request: { client, redirectUri, state, codeChallenge, isWriteRequested: isWriteScopeRequested(params.get("scope")) } };
}

/** The consent page with the request's parameters: where the decision sends the person back. */
export function getConsentPath(config: SoftureConfig, params: URLSearchParams): string {
  return `${getMcpAccessRoutes(config).oauthConsent}?${params.toString()}`;
}

function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { location, "cache-control": "no-store" } });
}

/** Whether the form was posted from this app: `Origin` must be the request's app origin. */
function isSameOrigin(request: Request, origins: McpOrigins): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === origins.appOrigin;
}

/**
 * The consent form, read up to `oauth.maxBodyBytes`, or the answer to a body that is too large
 * (413) or unreadable (400). Parsed by the platform, so urlencoded and multipart forms both work.
 */
async function readDecisionForm(config: SoftureConfig, request: Request): Promise<FormData | Response> {
  const refuse = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });
  const text = await readCappedBody(config, request);
  if (!text.ok) return refuse(text.error === "security.body_too_large" ? 413 : 400);
  const parsed = new Response(text.value, { headers: { "content-type": request.headers.get("content-type") ?? "" } });
  return (await parsed.formData().catch(() => null)) ?? refuse(400);
}

/**
 * `POST` of the consent form, answered with `303`: a plain form post, not a server action, because
 * the answer is a redirect to the client, possibly a native app scheme, and must work without
 * JavaScript. The form must come from the app's origin (the session cookie's `SameSite=Lax` is the
 * first layer), and the request is validated again from the posted fields. `userId` is the
 * session's user, or null: then the person goes back to the consent page, which asks them to sign in.
 */
export async function handleAuthorizationDecision(ctx: McpAccessContext, request: Request, userId: string | null): Promise<Response> {
  if (!isOAuthEnabled(ctx.config)) return new Response(null, { status: 404 });
  const origins = resolveMcpOrigins(ctx.config, request);
  if (!isSameOrigin(request, origins)) return new Response(null, { status: 403, headers: { "cache-control": "no-store" } });
  const form = await readDecisionForm(ctx.config, request);
  if (form instanceof Response) return form;

  const params = readAuthorizationParams(form);
  const consent = getConsentPath(ctx.config, params);
  if (userId === null) return seeOther(consent);
  try {
    const outcome = await validateAuthorizationRequest(ctx, params, origins);
    if (outcome.kind === "show-error") return seeOther(consent);
    if (outcome.kind === "redirect-error") return seeOther(outcome.location);

    const { client, redirectUri, state, codeChallenge, isWriteRequested } = outcome.request;
    if (form.get("decision") !== "allow") {
      return seeOther(buildClientRedirect(ctx.config, redirectUri, { error: "access_denied", error_description: "The person denied access.", state }, origins));
    }
    const code = await createAuthorizationCode(ctx, {
      clientRowId: client.id,
      userId,
      redirectUri,
      codeChallenge,
      // Writes need the client's request, the app's allowWrites and the person's tick.
      canWrite: isWriteRequested && getMcpAccessOptions(ctx.config).allowWrites && form.get("canWrite") !== null,
    });
    return seeOther(buildClientRedirect(ctx.config, redirectUri, { code, state }, origins));
  } catch (error) {
    console.error(`@softure-ai/mcp-access: recording an OAuth decision failed: ${errorLogLabel(error)}`);
    return new Response(null, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
