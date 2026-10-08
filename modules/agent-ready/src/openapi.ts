// OpenAPI 3.1 for the MCP endpoint. MCP is JSON-RPC 2.0 over Streamable HTTP, so the document describes the
// envelope, not the tools: `initialize`, `tools/list` and `tools/call` belong to the protocol, and listing tools here
// would be a second copy of the server's registry (the server card lists them, introspected).
import { getMcpServerTitle, getServiceDocTitle, getServiceDocUrl, type AgentDocumentContext } from "./context.js";
import { AUTHORIZATION_SERVER_METADATA_PATH } from "./paths.js";

/** The endpoint metadata of an authorization server, as far as OpenAPI's `oauth2` scheme needs it. */
export interface OAuthEndpoints {
  readonly authorization_endpoint?: unknown;
  readonly token_endpoint?: unknown;
}

function readUrl(value: unknown): string | null {
  return typeof value === "string" && URL.canParse(value) ? value : null;
}

/**
 * The OpenAPI document. With the authorization server's metadata it adds the `oauth2` scheme (authorization code on
 * the app host, the configured scopes); the bearer scheme is always there. `info.version` comes from
 * `openapi.version`: bump it when the envelope changes.
 */
export function buildOpenApiDocument(context: AgentDocumentContext, metadata: OAuthEndpoints | null = null) {
  const { options, origins } = context;
  const { read, write } = options.scopes;
  const path = options.mcp.path;
  const authorizationUrl = readUrl(metadata?.authorization_endpoint);
  const tokenUrl = readUrl(metadata?.token_endpoint);
  const hasOAuth = authorizationUrl !== null && tokenUrl !== null;
  const scopes = { [read]: "Read the account's data.", [write]: "Change the account's data (the deployment must allow writes too)." };
  const description =
    options.openapi.description ??
    `One entry point, \`POST ${path}\`, takes JSON-RPC 2.0 messages of the Model Context Protocol ` +
      "(https://modelcontextprotocol.io/specification). Tools are listed by the `tools/list` method. " +
      (hasOAuth
        ? `Access needs an account token: OAuth 2.1 with PKCE (metadata: ${AUTHORIZATION_SERVER_METADATA_PATH}) or a token issued by hand. `
        : "Access needs an account token sent as a bearer token. ") +
      `Writes need the \`${write}\` scope.`;

  return {
    openapi: "3.1.0",
    info: {
      title: options.openapi.title ?? getMcpServerTitle(context),
      version: options.openapi.version,
      summary: `Model Context Protocol over Streamable HTTP for ${options.title}.`,
      description,
    },
    servers: [{ url: origins.appOrigin }],
    externalDocs: { description: getServiceDocTitle(context), url: getServiceDocUrl(context) },
    security: hasOAuth ? [{ oauth2: [read] }, { bearerAuth: [] }] : [{ bearerAuth: [] }],
    paths: {
      [path]: {
        post: {
          operationId: "mcpMessage",
          summary: "A JSON-RPC message of the MCP protocol",
          parameters: [
            {
              name: "Accept",
              in: "header",
              required: true,
              description: "Streamable HTTP requires both types.",
              schema: { type: "string", example: "application/json, text/event-stream" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JsonRpcRequest" },
                example: { jsonrpc: "2.0", id: 1, method: "tools/list" },
              },
            },
          },
          responses: {
            "200": {
              description: "A JSON-RPC response (a result or a protocol error).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/JsonRpcResponse" } } },
            },
            "202": { description: "An accepted notification or client response, without a body." },
            "401": { description: "A missing, unknown or expired token. `WWW-Authenticate` says what is missing." },
            "403": { description: `A token without the \`${read}\` scope.` },
            "429": { description: "Too many requests from one address." },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ...(hasOAuth
          ? {
              oauth2: {
                type: "oauth2",
                description: `OAuth 2.1 with PKCE S256 and dynamic client registration (RFC 7591). Writes need the \`${write}\` scope, which the person approves separately.`,
                flows: { authorizationCode: { authorizationUrl, tokenUrl, refreshUrl: tokenUrl, scopes } },
              },
            }
          : {}),
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: `An account token. Scopes: \`${read}\` (every valid token) and \`${write}\` (writes).`,
        },
      },
      schemas: {
        JsonRpcRequest: {
          type: "object",
          required: ["jsonrpc", "method"],
          properties: {
            jsonrpc: { const: "2.0" },
            id: { type: ["string", "integer"] },
            method: { type: "string", examples: ["initialize", "tools/list", "tools/call"] },
            params: { type: "object" },
          },
        },
        JsonRpcResponse: {
          type: "object",
          required: ["jsonrpc"],
          properties: {
            jsonrpc: { const: "2.0" },
            id: { type: ["string", "integer", "null"] },
            result: { type: "object" },
            error: {
              type: "object",
              required: ["code", "message"],
              properties: { code: { type: "integer" }, message: { type: "string" }, data: {} },
            },
          },
        },
      },
    },
  };
}

