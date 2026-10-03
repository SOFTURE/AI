// The MCP endpoint (FIRE_TRACKER `src/app/api/mcp/route.ts`, generalised). It takes a Web
// `Request` and returns a `Response`, so it runs under any fetch-shaped host; the Next adapter only
// supplies the context. Order: identify the client, count the request, verify the Bearer token,
// then hand the request to a fresh server from the app's factory. Each refusal happens before the
// next step costs anything.
import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type McpServer,
  type Server,
} from "@modelcontextprotocol/server";
import { errorLogLabel, getModule } from "@softure-ai/core";
import { consumeRateLimit, identifyClient } from "@softure-ai/security/server";
import type { McpServerIdentity } from "../contract.js";
import { verifyAccessToken, type McpAccessContext } from "./tokens.js";

/** Every valid token reads. */
export const MCP_READ_SCOPE = "mcp:read";
/** A token that may write: issued for writes, and the app allows them. */
export const MCP_WRITE_SCOPE = "mcp:write";

/** The security bucket the endpoint counts in; `MCP_RATE_LIMIT_BUCKETS` holds its default. */
export const MCP_RATE_LIMIT_BUCKET = "mcp";

/** Larger bodies get 413 from the SDK before anything is parsed. No tool call needs more. */
export const MAX_MCP_REQUEST_BYTES = 1024 * 1024;

/** `AuthInfo.extra` key that carries the owner's user id to the factory. */
const USER_ID_CLAIM = "userId";
const BEARER_PREFIX = /^Bearer[ \t]+/i;
const NO_STORE = { "cache-control": "no-store" };

/** The app's MCP server for one request. It registers write tools only when `canWrite` is true. */
export type McpServerFactory = (identity: McpServerIdentity) => McpServer | Server | Promise<McpServer | Server>;

export interface McpEndpointOptions {
  readonly createServer: McpServerFactory;
}

/** Serves one request to the MCP endpoint. */
export type McpEndpoint = (ctx: McpAccessContext, request: Request) => Promise<Response>;

/**
 * The endpoint around the app's factory. The factory runs once per request with that request's
 * identity, so one account's server never answers another's request. Answers are plain JSON
 * (`responseMode: "json"`): a stream would add proxy buffering and timeouts for no tool that needs
 * it, and mid-call notifications are dropped.
 */
export function createMcpEndpoint({ createServer }: McpEndpointOptions): McpEndpoint {
  const handler = createMcpHandler(
    (requestContext) => createServer(readIdentity(requestContext.authInfo)),
    {
      responseMode: "json",
      maxRequestBodySize: MAX_MCP_REQUEST_BYTES,
      onerror: (error) => console.error(`@softure-ai/mcp-access: the MCP handler reported: ${errorLogLabel(error)}`),
    },
  );

  return async (ctx, request) => {
    assertRateLimitBucket(ctx);
    const client = identifyClient(ctx, request.headers);
    if (!client.ok) return Response.json({ error: "client_unidentified" }, { status: 400, headers: NO_STORE });

    let limit;
    try {
      // Counted before verification, so a flood of guesses is stopped before any lookup.
      limit = await consumeRateLimit(ctx, { bucket: MCP_RATE_LIMIT_BUCKET, key: client.value });
    } catch (error) {
      // Fails closed and says nothing: the route is public and this runs before authentication.
      console.error(`@softure-ai/mcp-access: counting a request failed: ${errorLogLabel(error)}`);
      return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: NO_STORE });
    }
    if (!limit.ok) {
      return Response.json(
        { error: "too_many_requests" },
        { status: 429, headers: { ...NO_STORE, "retry-after": String(limit.retryAfterSeconds) } },
      );
    }

    const authInfo = await authenticate(ctx, request.headers.get("authorization"));
    if (authInfo instanceof Response) return authInfo;
    return handler.fetch(request, { authInfo });
  };
}

/**
 * The verified identity as the SDK's `AuthInfo`, or the challenge response. Unknown, revoked,
 * expired and malformed tokens get the same `401 invalid_token`. Expiry is decided by the query on
 * the module's clock, not by the SDK's own check on the wall clock.
 */
async function authenticate(ctx: McpAccessContext, header: string | null): Promise<AuthInfo | Response> {
  const challenge = { requiredScopes: [MCP_READ_SCOPE] };
  if (header === null || !BEARER_PREFIX.test(header)) {
    return bearerAuthChallengeResponse(new OAuthError(OAuthErrorCode.InvalidToken, "Missing Bearer token"), challenge);
  }
  const token = header.replace(BEARER_PREFIX, "").trim();

  let verified;
  try {
    verified = await verifyAccessToken(ctx, token);
  } catch (error) {
    console.error(`@softure-ai/mcp-access: verifying a token failed: ${errorLogLabel(error)}`);
    return bearerAuthChallengeResponse(new OAuthError(OAuthErrorCode.ServerError, "Internal Server Error"), challenge);
  }
  if (verified === null) {
    return bearerAuthChallengeResponse(new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token"), challenge);
  }
  return {
    token,
    // The client is the token: it is what gets revoked, and its id may be logged.
    clientId: verified.tokenId,
    scopes: verified.canWrite ? [MCP_READ_SCOPE, MCP_WRITE_SCOPE] : [MCP_READ_SCOPE],
    // AuthInfo counts seconds; Date counts milliseconds.
    expiresAt: Math.floor(verified.expiresAt.getTime() / 1000),
    extra: { [USER_ID_CLAIM]: verified.userId },
  };
}

/** The factory's input from the request's `AuthInfo`; throws when the two sides disagree. */
function readIdentity(authInfo: AuthInfo | undefined): McpServerIdentity {
  const userId = authInfo?.extra?.[USER_ID_CLAIM];
  if (authInfo === undefined || typeof userId !== "string" || userId === "") {
    // Unreachable through the endpoint, which always passes a verified identity. A server built
    // without one would run queries with no account scope, so this refuses instead.
    throw new Error("@softure-ai/mcp-access: an MCP request reached the factory without a verified identity");
  }
  return { userId, canWrite: authInfo.scopes.includes(MCP_WRITE_SCOPE), tokenId: authInfo.clientId };
}

/** A missing bucket is a setup bug: thrown, so it reaches the log by name instead of a quiet 503. */
function assertRateLimitBucket(ctx: McpAccessContext): void {
  const options = getModule(ctx.config, "security")?.options as { buckets?: Record<string, unknown> } | undefined;
  if (options?.buckets?.[MCP_RATE_LIMIT_BUCKET] === undefined) {
    throw new Error(
      `@softure-ai/mcp-access: the security module has no "${MCP_RATE_LIMIT_BUCKET}" bucket; spread MCP_RATE_LIMIT_BUCKETS into security({ buckets })`,
    );
  }
}
