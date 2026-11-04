// The MCP endpoint (an adopting app's MCP route, generalised). It takes a Web
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
import { getProtectedResourceMetadataUrl, isOAuthEnabled } from "./oauth-http.js";
import { resolveMcpOrigins } from "./origins.js";
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "./scopes.js";
import { verifyAccessToken, type McpAccessContext } from "./tokens.js";
import {
  createSessionRenewalResponse,
  createToolListSessionId,
  isInitializeRequest,
  isToolListSessionCurrent,
  MCP_SESSION_ID_HEADER,
  rewriteInitializeAnswer,
} from "./tool-list-session.js";
import { isWritingEnabled } from "./writes-switch.js";

export { MCP_READ_SCOPE, MCP_WRITE_SCOPE };

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

/** Reads the tool list version the factory's servers answer at `initialize` for the identity. */
export type ToolListVersionReader = (identity: McpServerIdentity) => Promise<string>;

/** A factory that can tell its tool list version without building a server; `createMcpServerFactory` returns one. */
export interface VersionedMcpServerFactory extends McpServerFactory {
  readonly toolListVersion: ToolListVersionReader;
}

export interface McpEndpointOptions {
  readonly createServer: McpServerFactory | VersionedMcpServerFactory;
  /**
   * The tool list version per identity, for sessions tied to it (#1055). Default: the factory's own
   * `toolListVersion` (`createMcpServerFactory`). Without either, the endpoint issues no session id.
   */
  readonly toolListVersion?: ToolListVersionReader;
}

/** Serves one request to the MCP endpoint. */
export type McpEndpoint = (ctx: McpAccessContext, request: Request) => Promise<Response>;

/**
 * The endpoint around the app's factory. The factory runs once per request with that request's
 * identity, so one account's server never answers another's request. Answers are plain JSON
 * (`responseMode: "json"`): a stream would add proxy buffering and timeouts for no tool that needs
 * it, and mid-call notifications are dropped.
 */
export function createMcpEndpoint({ createServer, toolListVersion }: McpEndpointOptions): McpEndpoint {
  const readToolListVersion = toolListVersion ?? getFactoryToolListVersion(createServer);
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

    const authInfo = await authenticate(ctx, request);
    if (authInfo instanceof Response) return authInfo;
    return serveInSession(request, authInfo);
  };

  /**
   * Sessions tied to the tool list version (#1055): a session from another version (a release changed a tool, or the
   * access level changed) answers 404, so the client initializes again and lists the tools again; `initialize` gets a
   * new session id. A request without a session id is served as it always was.
   */
  async function serveInSession(request: Request, authInfo: AuthInfo): Promise<Response> {
    const sessionId = request.headers.get(MCP_SESSION_ID_HEADER);
    const isInitialize = sessionId === null && (await isInitializeRequest(request, MAX_MCP_REQUEST_BYTES));
    if (readToolListVersion === undefined || (sessionId === null && !isInitialize)) {
      const response = await handler.fetch(request, { authInfo });
      return isInitialize ? rewriteInitializeAnswer(response, null) : response;
    }
    let version;
    try {
      version = await readToolListVersion(readIdentity(authInfo));
    } catch (error) {
      // Without the version no session can be checked or issued: serve the request statelessly, as before #1055.
      console.error(`@softure-ai/mcp-access: reading the tool list version failed: ${errorLogLabel(error)}`);
      const response = await handler.fetch(request, { authInfo });
      return isInitialize ? rewriteInitializeAnswer(response, null) : response;
    }
    if (sessionId !== null) {
      return isToolListSessionCurrent(sessionId, version) ? handler.fetch(request, { authInfo }) : createSessionRenewalResponse();
    }
    return rewriteInitializeAnswer(await handler.fetch(request, { authInfo }), createToolListSessionId(version));
  }
}

/** The factory's own version reader, when it has one (`createMcpServerFactory`). */
function getFactoryToolListVersion(factory: McpServerFactory | VersionedMcpServerFactory): ToolListVersionReader | undefined {
  return "toolListVersion" in factory && typeof factory.toolListVersion === "function" ? factory.toolListVersion : undefined;
}

/**
 * The verified identity as the SDK's `AuthInfo`, or the challenge response. Unknown, revoked,
 * expired and malformed tokens get the same `401 invalid_token`. Expiry is decided by the query on
 * the module's clock, not by the SDK's own check on the wall clock. With OAuth on, the challenge
 * names the protected resource metadata (RFC 9728 §5.1): that is how claude.ai and ChatGPT find
 * the authorization server.
 */
async function authenticate(ctx: McpAccessContext, request: Request): Promise<AuthInfo | Response> {
  const header = request.headers.get("authorization");
  // Clients request the challenge's scope first (MCP authorization, scope selection), so it names
  // `mcp:write` while the app allows writes (`allowWrites` and the writes switch); the person's tick on
  // the consent page still decides. Read once per request: the switch can change between requests.
  const isWriteAllowed = await isWritingEnabled(ctx);
  const requiredScopes = isWriteAllowed ? [MCP_READ_SCOPE, MCP_WRITE_SCOPE] : [MCP_READ_SCOPE];
  const challenge = isOAuthEnabled(ctx.config)
    ? { requiredScopes, resourceMetadataUrl: getProtectedResourceMetadataUrl(ctx.config, resolveMcpOrigins(ctx.config, request)) }
    : { requiredScopes };
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
    scopes: verified.canWrite && isWriteAllowed ? [MCP_READ_SCOPE, MCP_WRITE_SCOPE] : [MCP_READ_SCOPE],
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
