// The route handlers an app mounts, one line each (README §4), e.g.
// `app/.well-known/api-catalog/route.ts`: `export { serveApiCatalog as GET } from "@softure-ai/agent-ready/next";`
// `createAgentReadyRoutes({ createServer })` builds the same handlers around the app's MCP server factory, so the
// factory stays out of `softure.config.ts` and only the route files import the server.
// Every handler reads the request (its host decides the origins), so Next never renders one at build time; add
// `export const dynamic = "force-dynamic"` anyway when the config reads the environment at runtime.
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { buildA2aAgentCard } from "../a2a-card.js";
import { buildAgentSkillsIndex, findAgentSkill, SKILL_MD_CONTENT_TYPE } from "../agent-skills.js";
import { buildAiCatalog } from "../ai-catalog.js";
import { API_CATALOG_CONTENT_TYPE, buildApiCatalog } from "../api-catalog.js";
import { AUTH_MD_CONTENT_TYPE, buildAuthMd } from "../auth-md.js";
import type { AgentDocumentContext } from "../context.js";
import { discoveryHeaders, formatJson, SHORT_DISCOVERY_CACHE_SECONDS } from "../http.js";
import { EMPTY_JWKS } from "../oauth.js";
import { buildOpenApiDocument } from "../openapi.js";
import type { McpServerFactory } from "../options.js";
import { readServedOrigin } from "../origins.js";
import { buildMcpServerCard } from "../server-card.js";
import {
  buildSignatureDirectory,
  getAuthority,
  getDirectorySignatureHeaders,
  readRetiredPublicKeys,
  readWebBotAuthKey,
  WEB_BOT_AUTH_DIRECTORY_CONTENT_TYPE,
} from "../server/web-bot-auth.js";
import { readMcpAccessSettings } from "../settings.js";
import {
  describeServer,
  getDocumentContext,
  getSupportedProtocolVersions,
  readIssuerMetadata,
  renderSkill,
  renderSkills,
  type DiscoveryServer,
} from "./documents.js";

const JSON_TYPE = "application/json";
const NOT_FOUND = { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } };

function notFound(): Response {
  return new Response("Not found\n", NOT_FOUND);
}

function json(body: unknown, contentType = JSON_TYPE, maxAge?: number): Response {
  return new Response(formatJson(body), { headers: discoveryHeaders(contentType, maxAge) });
}

const OWN_ERROR_PREFIX = "@softure-ai/agent-ready: ";

/** A setup error of this package names its fix and nothing secret, so its message is logged; anything else by label. */
function describeFailure(error: unknown): string {
  return error instanceof Error && error.message.startsWith(OWN_ERROR_PREFIX) ? error.message.slice(OWN_ERROR_PREFIX.length) : errorLogLabel(error);
}

/** What a document builder gets: the request's context and the app's MCP server for discovery. */
type DocumentBuilder = (context: AgentDocumentContext, server: DiscoveryServer) => Promise<Response> | Response;

/**
 * Runs `build` with the request's context. A failure (a malformed `Host`, a resolver or the module's setup, the MCP
 * server or the metadata provider throwing, no MCP server factory) is logged by name and answered with a 500 that
 * names nothing internal: a scanner sees an error, not a half-built document.
 */
async function serve(request: Request, document: string, createServer: McpServerFactory | undefined, build: DocumentBuilder): Promise<Response> {
  try {
    const config: SoftureConfig = getSoftureConfig();
    const context = getDocumentContext(config, request);
    const server = { factory: createServer ?? context.options.mcp.server, canWrite: readMcpAccessSettings(config)?.allowWrites ?? true };
    return await build(context, server);
  } catch (error) {
    console.error(`@softure-ai/agent-ready: building ${document} failed: ${describeFailure(error)}`);
    return Response.json({ error: "discovery_document_unavailable" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

/** A `GET` handler as Next takes it. */
type RouteHandler = (request: Request) => Promise<Response>;

/** The handlers an app mounts (README §4). */
export interface AgentReadyRoutes {
  /** `GET /.well-known/api-catalog` (RFC 9727). */
  readonly serveApiCatalog: RouteHandler;
  /** `GET /openapi.json`: the MCP endpoint's JSON-RPC envelope, with the OAuth URLs of the issuer's metadata. */
  readonly serveOpenApi: RouteHandler;
  /** `GET /auth.md` (WorkOS auth.md); 404 without `oauth`. */
  readonly serveAuthMd: RouteHandler;
  /** `GET /.well-known/jwks.json`: an empty key set (opaque tokens); 404 without `oauth`. */
  readonly serveJwks: RouteHandler;
  /** `GET /.well-known/mcp/server-card.json`: introspected on every request. */
  readonly serveMcpServerCard: RouteHandler;
  /** `GET /.well-known/agent-card.json` (A2A 1.0, MCP binding); 404 with `a2a.enabled: false`. */
  readonly serveA2aAgentCard: RouteHandler;
  /** `GET /.well-known/agent-skills/index.json` (Agent Skills Discovery v0.2.0). */
  readonly serveAgentSkillsIndex: RouteHandler;
  /**
   * `GET /.well-known/agent-skills/[name]/SKILL.md`: the bytes the index's digest covers. An unknown name answers 404
   * before anything is built: the route is public, and only the MCP skill needs the server.
   */
  readonly serveAgentSkill: (request: Request, route: { readonly params: Promise<{ readonly name: string }> }) => Promise<Response>;
  /** `GET /.well-known/ai-catalog.json` (ARD 1.0). */
  readonly serveAiCatalog: RouteHandler;
  /**
   * `GET /.well-known/http-message-signatures-directory` (Web Bot Auth): the signing key and the retired ones, signed
   * for the host it was asked on (the default port left out, as `@authority` requires). 404 (`no-store`) without a key:
   * there is nothing to verify against.
   */
  readonly serveSignatureDirectory: RouteHandler;
}

export interface AgentReadyRoutesOptions {
  /**
   * The app's MCP server factory: the one `@softure-ai/mcp-access`'s `createMcpRoute({ createServer })` takes. It is
   * called with an anonymous identity (`McpDiscoveryIdentity`) and no tool is called. Wins over `mcp.server`.
   */
  readonly createServer?: McpServerFactory;
}

/**
 * Every handler, the ones that introspect the server (server card, A2A card, skills index, MCP skill, AI catalog)
 * built around `createServer`, e.g. `export const agentReadyRoutes = createAgentReadyRoutes({ createServer });` in
 * `lib/agent-ready-routes.ts`, and `export const GET = agentReadyRoutes.serveMcpServerCard;` in a route file.
 */
export function createAgentReadyRoutes(options: AgentReadyRoutesOptions = {}): AgentReadyRoutes {
  const { createServer } = options;
  return {
    serveApiCatalog: (request) => serve(request, "the API catalog", createServer, (context) => json(buildApiCatalog(context), API_CATALOG_CONTENT_TYPE)),
    serveOpenApi: (request) =>
      serve(request, "the OpenAPI document", createServer, async (context) => json(buildOpenApiDocument(context, await readIssuerMetadata(context)))),
    serveAuthMd: (request) =>
      serve(request, "auth.md", createServer, async (context) => {
        const metadata = await readIssuerMetadata(context);
        if (metadata === null) return notFound();
        return new Response(buildAuthMd(context, metadata), { headers: discoveryHeaders(AUTH_MD_CONTENT_TYPE) });
      }),
    serveJwks: (request) => serve(request, "the JWKS", createServer, (context) => (context.options.oauth === undefined ? notFound() : json(EMPTY_JWKS))),
    serveMcpServerCard: (request) =>
      serve(request, "the MCP server card", createServer, async (context, server) =>
        json(buildMcpServerCard(context, { description: await describeServer(context, server), supportedProtocolVersions: getSupportedProtocolVersions(context) })),
      ),
    serveA2aAgentCard: (request) =>
      serve(request, "the A2A agent card", createServer, async (context, server) =>
        context.options.a2a.enabled ? json(buildA2aAgentCard(context, await describeServer(context, server))) : notFound(),
      ),
    serveAgentSkillsIndex: (request) =>
      serve(request, "the agent skills index", createServer, async (context, server) =>
        json(buildAgentSkillsIndex(await renderSkills(context, server)), JSON_TYPE, SHORT_DISCOVERY_CACHE_SECONDS),
      ),
    serveAgentSkill: async (request, route) => {
      const { name } = await route.params;
      return serve(request, `the skill ${name.slice(0, 64)}`, createServer, async (context, server) => {
        const skill = findAgentSkill(await renderSkill(context, name, server), name);
        if (skill === undefined) return notFound();
        return new Response(skill.markdown, { headers: discoveryHeaders(SKILL_MD_CONTENT_TYPE, SHORT_DISCOVERY_CACHE_SECONDS) });
      });
    },
    serveAiCatalog: (request) =>
      serve(request, "the AI catalog", createServer, async (context, server) =>
        json(buildAiCatalog(context, await renderSkills(context, server)), JSON_TYPE, SHORT_DISCOVERY_CACHE_SECONDS),
      ),
    serveSignatureDirectory: (request) =>
      serve(request, "the signature directory", createServer, (context) => {
        const names = context.options.webBotAuth;
        const key = readWebBotAuthKey(process.env, names);
        if (key === null) return notFound();
        return new Response(formatJson(buildSignatureDirectory(key, readRetiredPublicKeys(process.env, names))), {
          headers: { ...discoveryHeaders(WEB_BOT_AUTH_DIRECTORY_CONTENT_TYPE), ...getDirectorySignatureHeaders(getAuthority(readServedOrigin(request)), { key }) },
        });
      }),
  };
}

/** The handlers with the factory from the config's `mcp.server`, mounted with one re-export line each. */
export const {
  serveApiCatalog,
  serveOpenApi,
  serveAuthMd,
  serveJwks,
  serveMcpServerCard,
  serveA2aAgentCard,
  serveAgentSkillsIndex,
  serveAgentSkill,
  serveAiCatalog,
  serveSignatureDirectory,
} = createAgentReadyRoutes();
