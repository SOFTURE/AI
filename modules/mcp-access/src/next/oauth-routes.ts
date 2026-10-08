// The OAuth routes, each mounted with one line (README §4), e.g.
// `app/api/oauth/token/route.ts → export { exchangeOAuthTokenRoute as POST, answerOAuthPreflight as OPTIONS } from "@softure-ai/mcp-access/next";`
// They supply the module context (and, for the decision, the session's user) to the handlers in
// `/server`. With `oauth.enabled` off every one answers 404.
import { getCurrentUser } from "@softure-ai/auth/next";
import { errorLogLabel } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import {
  answerOAuthPreflight,
  getAuthorizationServerMetadata,
  getProtectedResourceMetadata,
  getRootProtectedResourceMetadata,
  handleAuthorizationDecision,
  handleClientRegistration,
  handleTokenRequest,
  serveDiscoveryDocument,
} from "../server/oauth-http.js";
import type { McpAccessContext } from "../server/tokens.js";
import { getMcpAccessContext } from "./context.js";

const UNAVAILABLE = { status: 503, headers: { "cache-control": "no-store" } };

async function withContext(request: Request, handle: (ctx: McpAccessContext, request: Request) => Promise<Response>): Promise<Response> {
  let ctx;
  try {
    ctx = await getMcpAccessContext();
  } catch (error) {
    console.error(`@softure-ai/mcp-access: opening the database failed: ${errorLogLabel(error)}`);
    return Response.json({ error: "temporarily_unavailable" }, UNAVAILABLE);
  }
  return handle(ctx, request);
}

/**
 * `GET /.well-known/oauth-authorization-server`. Reads the request, so Next never renders it at
 * build time with one origin baked in.
 */
export function getAuthorizationServerMetadataRoute(request: Request): Response {
  return serveDiscoveryDocument(getSoftureConfig(), (config, origins) => getAuthorizationServerMetadata(config, origins), request);
}

/**
 * `GET /.well-known/oauth-protected-resource` and `…/oauth-protected-resource/api/mcp`: the same
 * export at both paths; the request's path picks the variant.
 */
export function getProtectedResourceMetadataRoute(request: Request): Response {
  const isRoot = new URL(request.url).pathname.replace(/\/+$/, "").endsWith("/oauth-protected-resource");
  return serveDiscoveryDocument(
    getSoftureConfig(),
    isRoot ? getRootProtectedResourceMetadata : (config, origins) => getProtectedResourceMetadata(config, "endpoint", origins),
    request,
  );
}

/** `POST /api/oauth/register`. */
export function registerOAuthClientRoute(request: Request): Promise<Response> {
  return withContext(request, handleClientRegistration);
}

/** `POST /api/oauth/token`. */
export function exchangeOAuthTokenRoute(request: Request): Promise<Response> {
  return withContext(request, handleTokenRequest);
}

/** `POST /api/oauth/authorize`: the consent form's decision, answered with `303`. */
export function decideOAuthAuthorizationRoute(request: Request): Promise<Response> {
  return withContext(request, async (ctx, req) => {
    const user = await getCurrentUser();
    return handleAuthorizationDecision(ctx, req, user?.id ?? null);
  });
}

export { answerOAuthPreflight };
