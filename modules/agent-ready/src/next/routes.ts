// The route handlers an app mounts, one line each (README §4), e.g.
// `app/.well-known/api-catalog/route.ts`: `export { serveApiCatalog as GET } from "@softure-ai/agent-ready/next";`
// Every handler reads the request (its host decides the origins), so Next never renders one at build time; add
// `export const dynamic = "force-dynamic"` anyway when the config reads the environment at runtime.
import { errorLogLabel } from "@softure-ai/core";
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
import { describeServer, getDocumentContext, getSupportedProtocolVersions, readIssuerMetadata, renderSkill, renderSkills } from "./documents.js";

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

/**
 * Runs `build` with the request's context. A failure (a malformed `Host`, a resolver or the module's setup, the MCP
 * server or the metadata provider throwing) is logged by name and answered with a 500 that names nothing internal: a
 * scanner sees an error, not a half-built document.
 */
async function serve(request: Request, document: string, build: (context: AgentDocumentContext) => Promise<Response> | Response): Promise<Response> {
  try {
    return await build(getDocumentContext(getSoftureConfig(), request));
  } catch (error) {
    console.error(`@softure-ai/agent-ready: building ${document} failed: ${describeFailure(error)}`);
    return Response.json({ error: "discovery_document_unavailable" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

/** `GET /.well-known/api-catalog` (RFC 9727). */
export function serveApiCatalog(request: Request): Promise<Response> {
  return serve(request, "the API catalog", (context) => json(buildApiCatalog(context), API_CATALOG_CONTENT_TYPE));
}

/** `GET /openapi.json`: the MCP endpoint's JSON-RPC envelope, with the OAuth URLs of the issuer's metadata. */
export function serveOpenApi(request: Request): Promise<Response> {
  return serve(request, "the OpenAPI document", async (context) => json(buildOpenApiDocument(context, await readIssuerMetadata(context))));
}

/** `GET /auth.md` (WorkOS auth.md); 404 without `oauth`. */
export function serveAuthMd(request: Request): Promise<Response> {
  return serve(request, "auth.md", async (context) => {
    const metadata = await readIssuerMetadata(context);
    if (metadata === null) return notFound();
    return new Response(buildAuthMd(context, metadata), { headers: discoveryHeaders(AUTH_MD_CONTENT_TYPE) });
  });
}

/** `GET /.well-known/jwks.json`: an empty key set (opaque tokens); 404 without `oauth`. */
export function serveJwks(request: Request): Promise<Response> {
  return serve(request, "the JWKS", (context) => (context.options.oauth === undefined ? notFound() : json(EMPTY_JWKS)));
}

/** `GET /.well-known/mcp/server-card.json`: introspected on every request. */
export function serveMcpServerCard(request: Request): Promise<Response> {
  return serve(request, "the MCP server card", async (context) =>
    json(buildMcpServerCard(context, { description: await describeServer(context), supportedProtocolVersions: getSupportedProtocolVersions(context) })),
  );
}

/** `GET /.well-known/agent-card.json` (A2A 1.0, MCP binding); 404 with `a2a.enabled: false`. */
export function serveA2aAgentCard(request: Request): Promise<Response> {
  return serve(request, "the A2A agent card", async (context) => (context.options.a2a.enabled ? json(buildA2aAgentCard(context, await describeServer(context))) : notFound()));
}

/** `GET /.well-known/agent-skills/index.json` (Agent Skills Discovery v0.2.0). */
export function serveAgentSkillsIndex(request: Request): Promise<Response> {
  return serve(request, "the agent skills index", async (context) => json(buildAgentSkillsIndex(await renderSkills(context)), JSON_TYPE, SHORT_DISCOVERY_CACHE_SECONDS));
}

/**
 * `GET /.well-known/agent-skills/[name]/SKILL.md`: the bytes the index's digest covers. An unknown name answers 404
 * before anything is built: the route is public, and only the MCP skill needs the server.
 */
export async function serveAgentSkill(request: Request, route: { readonly params: Promise<{ readonly name: string }> }): Promise<Response> {
  const { name } = await route.params;
  return serve(request, `the skill ${name.slice(0, 64)}`, async (context) => {
    const skill = findAgentSkill(await renderSkill(context, name), name);
    if (skill === undefined) return notFound();
    return new Response(skill.markdown, { headers: discoveryHeaders(SKILL_MD_CONTENT_TYPE, SHORT_DISCOVERY_CACHE_SECONDS) });
  });
}

/** `GET /.well-known/ai-catalog.json` (ARD 1.0). */
export function serveAiCatalog(request: Request): Promise<Response> {
  return serve(request, "the AI catalog", async (context) => json(buildAiCatalog(context, await renderSkills(context)), JSON_TYPE, SHORT_DISCOVERY_CACHE_SECONDS));
}

/**
 * `GET /.well-known/http-message-signatures-directory` (Web Bot Auth): the signing key and the retired ones, signed
 * for the host it was asked on (the default port left out, as `@authority` requires). 404 (`no-store`) without a key: there is nothing to verify against.
 */
export function serveSignatureDirectory(request: Request): Promise<Response> {
  return serve(request, "the signature directory", (context) => {
    const names = context.options.webBotAuth;
    const key = readWebBotAuthKey(process.env, names);
    if (key === null) return notFound();
    return new Response(formatJson(buildSignatureDirectory(key, readRetiredPublicKeys(process.env, names))), {
      headers: { ...discoveryHeaders(WEB_BOT_AUTH_DIRECTORY_CONTENT_TYPE), ...getDirectorySignatureHeaders(getAuthority(readServedOrigin(request)), { key }) },
    });
  });
}
