// Shared setup: an app configuration with security, auth and mcp-access, a migrated PGlite
// database, accounts, and a demo MCP server with one read and one write tool.
import { McpServer } from "@modelcontextprotocol/server";
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { MCP_RATE_LIMIT_BUCKETS, mcpAccess, type McpAccessOptionsInput, type McpServerIdentity } from "@softure-ai/mcp-access";
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  getCodeChallenge,
  registerMcpClient,
  type IssuedOAuthTokens,
  type McpAccessContext,
  type RegisteredOAuthClient,
} from "@softure-ai/mcp-access/server";
import { headerIp, security } from "@softure-ai/security";
import { z } from "zod";

export const NOW = new Date("2026-09-15T12:00:00Z");
export const CLIENT_IP = "203.0.113.7";
export const ENDPOINT = "http://localhost:3000/api/mcp";

export const OPTIONS: McpAccessOptionsInput = {
  serverName: "acme",
  allowWrites: true,
  tools: [
    { name: "whoami", access: "read", description: { en: "Says whose account this is.", pl: "Says whose account this is (pl)." } },
    { name: "add_note", access: "write", description: { en: "Adds a note." } },
  ],
};

export function createConfig(options: McpAccessOptionsInput = OPTIONS, locale: "en" | "pl" = "en"): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale,
    timezone: "Europe/Warsaw",
    appOrigin: "http://localhost:3000",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...MCP_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
      auth({ password: { scrypt: { cost: 2 ** 10 } } }),
      mcpAccess(options),
    ],
  });
}

export interface TestMcp {
  readonly ctx: McpAccessContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
}

export async function createTestMcp(config: SoftureConfig = createConfig()): Promise<TestMcp> {
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database, config };
}

/** Inserts an account straight into auth.users and returns its id. */
export async function createUser(database: TestDatabase, email: string): Promise<string> {
  const result = await database.client.query<{ id: string }>(
    "INSERT INTO auth.users (email, password_hash, created_at, password_changed_at) VALUES ($1, 'scrypt$test', $2, $2) RETURNING id",
    [email, NOW],
  );
  const id = result.rows[0]?.id;
  if (id === undefined) throw new Error(`createUser: no id for ${email}`);
  return id;
}

/** The demo server: `whoami` for every token, `add_note` only for one that can write. */
export function createDemoServer(identity: McpServerIdentity): McpServer {
  const server = new McpServer({ name: "acme", version: "1.0.0" });
  server.registerTool("whoami", { description: "Says whose account this is." }, () => ({
    content: [{ type: "text", text: JSON.stringify({ userId: identity.userId, canWrite: identity.canWrite }) }],
  }));
  if (identity.canWrite) {
    server.registerTool("add_note", { description: "Adds a note.", inputSchema: z.object({ text: z.string() }) }, ({ text }) => ({
      content: [{ type: "text", text: `noted: ${text}` }],
    }));
  }
  return server;
}

/** A JSON-RPC POST to the endpoint, as a 2025-era MCP client sends it. */
export function createMcpRequest(body: unknown, options: { token?: string; authorization?: string; ip?: string | null } = {}): Request {
  const headers = new Headers({ "content-type": "application/json", accept: "application/json, text/event-stream" });
  if (options.ip !== null) headers.set("x-real-ip", options.ip ?? CLIENT_IP);
  const authorization = options.authorization ?? (options.token === undefined ? undefined : `Bearer ${options.token}`);
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) });
}

export function callTool(name: string, args: Record<string, unknown> = {}, id = 1) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

export function listTools(id = 1) {
  return { jsonrpc: "2.0", id, method: "tools/list", params: {} };
}

/** The database handle with one query builder failing, as with the database down or a table missing. */
export function failOn(db: McpAccessContext["db"], method: "select" | "insert" | "update", message: string): McpAccessContext["db"] {
  const fail = () => {
    throw new Error(message);
  };
  return new Proxy(db, { get: (target, key): unknown => (key === method ? fail : (Reflect.get(target, key) as unknown)) });
}

export const OAUTH_OPTIONS: McpAccessOptionsInput = { ...OPTIONS, oauth: { enabled: true } };
export const REDIRECT_URI = "https://assistant.example/oauth/callback";
export const VERIFIER = "v".repeat(43);

/** Registers a public client, records the person's consent and exchanges the code: a connected app. */
export async function connectApp(
  ctx: McpAccessContext,
  userId: string,
  options: { readonly canWrite?: boolean; readonly clientName?: string } = {},
): Promise<{ readonly client: RegisteredOAuthClient["client"]; readonly tokens: IssuedOAuthTokens }> {
  const { client } = await registerMcpClient(ctx, { clientName: options.clientName ?? "Assistant", redirectUris: [REDIRECT_URI], tokenEndpointAuthMethod: "none" });
  const code = await createAuthorizationCode(ctx, {
    clientRowId: client.id,
    userId,
    redirectUri: REDIRECT_URI,
    codeChallenge: getCodeChallenge(VERIFIER),
    canWrite: options.canWrite ?? false,
  });
  const tokens = await exchangeAuthorizationCode(ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER });
  if (tokens === null) throw new Error("connectApp: the exchange was refused");
  return { client, tokens };
}
