// The routes `softure-deploy verify` checks after a deploy, so a document that stopped answering, changed its type or
// lost the host it names fails the release instead of a scanner a week later. One manifest per host: verify checks
// one URL, and the apex and the app host serve different documents. Markers are quoted values (`"https://…"`), which
// read the same in indented and compact JSON. Digests and signatures need a computation, so `agent-ready check <url>`
// covers them.
import { getMcpSkillName } from "./mcp-skill.js";
import { getHomeLinks } from "./link-header.js";
import type { AgentReadyOptions } from "./options.js";
import { trimOrigin } from "./origins.js";
import {
  A2A_AGENT_CARD_PATH,
  AGENT_SKILLS_INDEX_PATH,
  AI_CATALOG_PATH,
  API_CATALOG_PATH,
  AUTH_MD_PATH,
  AUTHORIZATION_SERVER_METADATA_PATH,
  JWKS_PATH,
  MCP_SERVER_CARD_PATH,
  OPENAPI_PATH,
  PROTECTED_RESOURCE_METADATA_PATH,
  skillPath,
  WEB_BOT_AUTH_DIRECTORY_PATH,
} from "./paths.js";

/** One entry of `verify.routes` in `deploy.json` (`@softure-ai/deploy`). */
export interface VerifyRoute {
  readonly path: string;
  readonly status: number;
  readonly contains?: readonly string[];
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: "POST";
  readonly body?: string;
  readonly requestHeaders?: Readonly<Record<string, string>>;
}

export interface VerifyManifestOptions {
  /** The host the manifest is for: the apex serves the documents, the app host the MCP endpoint and OAuth. */
  readonly host: "apex" | "app";
  /** The module's parsed options: `agentReady({ ... }).options`. */
  readonly options: AgentReadyOptions;
  /** The deployed origins. */
  readonly origins: { readonly appOrigin: string; readonly apexOrigin: string };
  /** Whether the deployment has a Web Bot Auth key; without one the directory answers 404 by design. */
  readonly signatureDirectory?: boolean;
  /** Whether `/` registers WebMCP tools (an inline boot script, so `modelContext` is in the HTML). */
  readonly webMcp?: boolean;
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

const JSON_TYPE = { "content-type": "application/json" };

function buildDocumentRoutes(input: VerifyManifestOptions): VerifyRoute[] {
  const { options } = input;
  const apex = trimOrigin(input.origins.apexOrigin);
  const app = trimOrigin(input.origins.appOrigin);
  const endpoint = quoted(`${app}${options.mcp.path}`);
  const routes: VerifyRoute[] = [
    ...getHomeLinks({ serviceDocPath: options.serviceDoc.path, markdown: options.markdown }).map((link) => ({
      path: "/",
      status: 200,
      headers: { link: `rel="${link.rel}"` },
    })),
    ...(input.webMcp === true ? [{ path: "/", status: 200, contains: ["modelContext"] }] : []),
    { path: API_CATALOG_PATH, status: 200, contains: ['"linkset"', endpoint], headers: { "content-type": "application/linkset+json" } },
    { path: OPENAPI_PATH, status: 200, contains: ['"3.1.0"', quoted(app)], headers: JSON_TYPE },
    { path: MCP_SERVER_CARD_PATH, status: 200, contains: [endpoint, '"tools"'], headers: JSON_TYPE },
    ...(options.a2a.enabled ? [{ path: A2A_AGENT_CARD_PATH, status: 200, contains: [endpoint, '"MCP"'], headers: JSON_TYPE }] : []),
    { path: AGENT_SKILLS_INDEX_PATH, status: 200, contains: ['"sha256:'], headers: JSON_TYPE },
    { path: AI_CATALOG_PATH, status: 200, contains: ['"specVersion"', quoted(`${apex}${MCP_SERVER_CARD_PATH}`)], headers: JSON_TYPE },
  ];
  const skillNames = [...options.skills.map((skill) => skill.name)];
  const mcpSkill = getMcpSkillName({ options, origins: { appOrigin: app, apexOrigin: apex, requestOrigin: apex } });
  if (mcpSkill !== null) skillNames.push(mcpSkill);
  for (const name of skillNames) {
    routes.push({ path: skillPath(name), status: 200, contains: [`name: ${name}`], headers: { "content-type": "text/markdown" } });
  }
  if (options.oauth !== undefined) {
    routes.push(
      { path: AUTH_MD_PATH, status: 200, contains: ["# auth.md", `${app}${options.mcp.path}`], headers: { "content-type": "text/markdown" } },
      { path: PROTECTED_RESOURCE_METADATA_PATH, status: 200, contains: [quoted(apex)] },
    );
  }
  if (input.signatureDirectory === true) {
    routes.push({
      path: WEB_BOT_AUTH_DIRECTORY_PATH,
      status: 200,
      contains: ['"Ed25519"'],
      headers: { "content-type": "application/http-message-signatures-directory+json", "signature-input": 'tag="http-message-signatures-directory"' },
    });
  }
  return routes;
}

function buildAppRoutes(input: VerifyManifestOptions): VerifyRoute[] {
  const { options } = input;
  const apex = trimOrigin(input.origins.apexOrigin);
  const app = trimOrigin(input.origins.appOrigin);
  const routes: VerifyRoute[] = [
    {
      path: options.mcp.path,
      status: 401,
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      requestHeaders: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      headers: { "www-authenticate": "resource_metadata=" },
    },
  ];
  if (options.oauth !== undefined) {
    routes.push(
      { path: JWKS_PATH, status: 200, contains: ['"keys"'], headers: JSON_TYPE },
      {
        path: AUTHORIZATION_SERVER_METADATA_PATH,
        status: 200,
        contains: [quoted(`${app}${JWKS_PATH}`), quoted(`${apex}${AUTH_MD_PATH}`)],
        headers: JSON_TYPE,
      },
      { path: `${PROTECTED_RESOURCE_METADATA_PATH}${options.mcp.path}`, status: 200, contains: [quoted(`${app}${options.mcp.path}`)], headers: JSON_TYPE },
    );
  }
  return routes;
}

/**
 * `verify.routes` for one host. With one host for everything (apex = app), ask for either: the manifest holds both
 * sets. Merge the result into the app's own routes in `deploy.json`.
 */
export function buildVerifyManifest(input: VerifyManifestOptions): VerifyRoute[] {
  const isSingleHost = trimOrigin(input.origins.apexOrigin) === trimOrigin(input.origins.appOrigin);
  if (isSingleHost) return [...buildDocumentRoutes(input), ...buildAppRoutes(input)];
  return input.host === "apex" ? buildDocumentRoutes(input) : buildAppRoutes(input);
}
