// Issue #961: personal tokens for an app's plain HTTP routes. An API token carries the app's prefix and
// scopes, shares the table, limit, expiry, privacy and prune with MCP tokens, and passes only
// `requireApiToken`; an MCP token never passes it, and an API token never opens the MCP endpoint.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { createTestClock, defineModule, defineSoftureConfig, type SoftureConfig, type SwitchReading } from "@softure-ai/core";
import { createTestDatabase } from "@softure-ai/db/testing";
import { API_TOKEN_RATE_LIMIT_BUCKETS, MCP_RATE_LIMIT_BUCKETS, mcpAccess, WRITES_ENABLED_SWITCH, type McpAccessOptionsInput } from "@softure-ai/mcp-access";
import { exportMcpAccessUserData, issueAccessToken, verifyAccessToken } from "@softure-ai/mcp-access/server";
import {
  apiTokenErrorResponse,
  issueApiToken,
  listAccessTokens,
  pruneAccessTokens,
  requireApiToken,
  revokeAccessToken,
  verifyApiToken,
  type ApiTokenRefusal,
  type McpAccessContext,
} from "@softure-ai/mcp-access/tokens";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, failOn, NOW } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ROUTE = "http://localhost:3000/api/recipes";

const API_OPTIONS: McpAccessOptionsInput = {
  serverName: "acme",
  allowWrites: true,
  apiTokens: {
    prefix: "acme_",
    scopes: [
      { name: "recipes:read", access: "read", description: { en: "Reads your recipes." } },
      { name: "recipes:write", access: "write", description: { en: "Adds and changes recipes." } },
    ],
    examples: [{ title: { en: "curl" }, text: { en: "curl -H 'Authorization: Bearer {token}' {appOrigin}/api/recipes" } }],
  },
};

function writesSwitch(isEnabled: boolean) {
  const manifest = {
    id: "switch-provider",
    version: "0.0.0",
    dependsOn: {},
    dbSchema: null,
    tables: [],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  };
  const reader = (_context: unknown, name: string) =>
    Promise.resolve<SwitchReading>(name === WRITES_ENABLED_SWITCH ? { kind: "value", isEnabled } : { kind: "undeclared" });
  return defineModule({ manifest, messages: { en: {}, pl: {} }, switchReader: reader })();
}

function createConfig(options: McpAccessOptionsInput = API_OPTIONS, extra: { writesOn?: boolean; tokenLimit?: number } = {}): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: "http://localhost:3000",
    modules: [
      security({
        clientIp: headerIp("x-real-ip"),
        buckets: {
          ...AUTH_RATE_LIMIT_BUCKETS,
          ...MCP_RATE_LIMIT_BUCKETS,
          ...API_TOKEN_RATE_LIMIT_BUCKETS,
          "api-token": { limit: extra.tokenLimit ?? 120, windowMinutes: 15, key: "subject" },
        },
        cleanupProbability: 0,
      }),
      auth({ password: { scrypt: { cost: 2 ** 10 } } }),
      mcpAccess(options),
      ...(extra.writesOn === undefined ? [] : [writesSwitch(extra.writesOn)]),
    ],
  });
}

function routeRequest(token?: string, ip: string | null = "203.0.113.7"): Request {
  const headers = new Headers();
  if (ip !== null) headers.set("x-real-ip", ip);
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  return new Request(ROUTE, { headers });
}

describe("API tokens (#961)", () => {
  let ctx: McpAccessContext;
  let close: () => Promise<void>;
  let query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  let alice: string;
  let bob: string;

  async function setUp(config: SoftureConfig = createConfig()) {
    const database = await createTestDatabase(config.modules);
    ctx = { db: database.db, clock: createTestClock(NOW), config };
    close = () => database.close();
    query = async <T,>(sql: string, params: unknown[] = []) => (await database.client.query<T>(sql, params)).rows;
    alice = await createUser(database, "alice@example.com");
    bob = await createUser(database, "bob@example.com");
  }

  beforeEach(async () => {
    await setUp();
  });
  afterEach(async () => {
    await close();
    vi.restoreAllMocks();
  });

  async function issue(userId: string, scopes: readonly string[] = ["recipes:read"], name = "Shortcut") {
    const result = await issueApiToken(ctx, { userId, name, scopes });
    if (!result.ok) throw new Error(`issue failed: ${result.error}`);
    return result.value;
  }

  async function refusal(request: Request, scopes: readonly string[] = ["recipes:read"]): Promise<ApiTokenRefusal> {
    const result = await requireApiToken(ctx, request, { scopes });
    if (result.ok) throw new Error("expected a refusal");
    return result;
  }

  describe("options", () => {
    const scopes = [{ name: "recipes:read", access: "read" as const, description: { en: "Reads." } }];
    const optionsOf = (input: McpAccessOptionsInput) => mcpAccess(input).options;

    it("defaults the prefix to sftapi_ and the examples to none, and leaves API tokens off without apiTokens", () => {
      const parsed = optionsOf({ serverName: "acme", apiTokens: { scopes } });
      expect([parsed.apiTokens?.prefix, parsed.apiTokens?.examples]).toEqual(["sftapi_", []]);
      expect(optionsOf({ serverName: "acme" }).apiTokens).toBeUndefined();
    });

    it("refuses the module's own prefixes, mcp scopes, duplicates, bad names and an empty scope list", () => {
      const build = (apiTokens: McpAccessOptionsInput["apiTokens"]) => () => mcpAccess({ serverName: "acme", apiTokens });
      expect(build({ prefix: "sftmcp_", scopes })).toThrow("must not start with sftmc");
      expect(build({ prefix: "sftmca_", scopes })).toThrow("must not start with sftmc");
      expect(build({ prefix: "Acme_", scopes })).toThrow("options.apiTokens.prefix");
      expect(build({ scopes: [{ ...scopes[0], name: "mcp:read" }] as never })).toThrow("mcp scopes belong to the MCP endpoint");
      expect(build({ scopes: [...scopes, ...scopes] })).toThrow('"recipes:read" is listed twice');
      expect(build({ scopes: [] })).toThrow("needs at least one scope");
      expect(build({ scopes: [{ ...scopes[0], name: "Recipes write" }] as never })).toThrow("must be lowercase segments");
    });
  });

  describe("issueApiToken", () => {
    it("returns the plaintext with the app's prefix once and stores its hash with kind api and the scopes", async () => {
      const issued = await issue(alice, ["recipes:write", "recipes:read"]);
      expect(issued.token).toMatch(/^acme_[A-Za-z0-9_-]{43}$/);
      expect([issued.scopes, issued.expiresAt]).toEqual([["recipes:read", "recipes:write"], new Date(NOW.getTime() + 90 * DAY_MS)]);
      const rows = await query<{ kind: string; scopes: string[]; can_write: boolean }>("SELECT kind, scopes, can_write FROM mcp.access_tokens");
      expect(rows).toEqual([{ kind: "api", scopes: ["recipes:read", "recipes:write"], can_write: true }]);
      expect(JSON.stringify(await query("SELECT * FROM mcp.access_tokens"))).not.toContain(issued.token);
    });

    it("refuses an undeclared scope, no scope, a blank name and an app without apiTokens", async () => {
      expect(await issueApiToken(ctx, { userId: alice, name: "x", scopes: ["recipes:read", "orders:read"] })).toEqual({ ok: false, error: "mcp-access.scope_unknown" });
      expect(await issueApiToken(ctx, { userId: alice, name: "x", scopes: [] })).toEqual({ ok: false, error: "mcp-access.scope_required" });
      expect(await issueApiToken(ctx, { userId: alice, name: " ", scopes: ["recipes:read"] })).toEqual({ ok: false, error: "mcp-access.name_required" });
      await close();
      await setUp(createConfig({ serverName: "acme" }));
      expect(await issueApiToken(ctx, { userId: alice, name: "x", scopes: ["recipes:read"] })).toEqual({ ok: false, error: "mcp-access.api_tokens_disabled" });
    });

    it("leaves write scopes out while the app does not allow writes, and refuses when nothing is left", async () => {
      await close();
      await setUp(createConfig({ ...API_OPTIONS, allowWrites: false }));
      expect((await issue(alice, ["recipes:read", "recipes:write"])).scopes).toEqual(["recipes:read"]);
      expect(await issueApiToken(ctx, { userId: alice, name: "x", scopes: ["recipes:write"] })).toEqual({ ok: false, error: "mcp-access.scope_required" });
    });

    it("shares the per-account limit with MCP tokens", async () => {
      await close();
      await setUp(createConfig({ ...API_OPTIONS, maxTokensPerUser: 2 }));
      await issueAccessToken(ctx, { userId: alice, name: "Laptop", canWrite: false });
      await issue(alice);
      expect(await issueApiToken(ctx, { userId: alice, name: "x", scopes: ["recipes:read"] })).toEqual({ ok: false, error: "mcp-access.token_limit_reached" });
      expect((await issueAccessToken(ctx, { userId: alice, name: "Desk", canWrite: false })).ok).toBe(false);
    });
  });

  describe("the two kinds stay apart", () => {
    it("an API token never opens the MCP endpoint, an MCP token never passes requireApiToken", async () => {
      const api = await issue(alice);
      const mcp = await issueAccessToken(ctx, { userId: alice, name: "Laptop", canWrite: true });
      if (!mcp.ok) throw new Error("issue failed");
      expect(await verifyAccessToken(ctx, api.token)).toBeNull();
      expect(await verifyApiToken(ctx, mcp.value.token)).toBeNull();
      expect((await refusal(routeRequest(mcp.value.token))).error).toBe("mcp-access.api_token_invalid");
    });

    it("an MCP prefix with the API token's secret is still refused", async () => {
      const api = await issue(alice);
      const forged = `sftmcp_${api.token.slice("acme_".length)}`;
      expect(await verifyAccessToken(ctx, forged)).toBeNull();
    });

    it("the database refuses an API row without scopes and an MCP row with scopes", async () => {
      const insert = (kind: string, scopes: string) =>
        query(
          `INSERT INTO mcp.access_tokens (user_id, name, token_hash, can_write, created_at, expires_at, kind, scopes)
           VALUES ($1, 'x', repeat('a', 64), false, now(), now() + interval '1 day', $2, $3::text[])`,
          [alice, kind, scopes],
        );
      await expect(insert("api", "{}")).rejects.toThrow(/access_tokens_kind_scopes_check/);
      await expect(insert("mcp", "{recipes:read}")).rejects.toThrow(/access_tokens_kind_scopes_check/);
      await expect(insert("other", "{}")).rejects.toThrow(/access_tokens_kind_scopes_check/);
    });
  });

  describe("requireApiToken", () => {
    it("answers the owner, the token id and the scopes for a valid token with the scope", async () => {
      const issued = await issue(alice, ["recipes:read", "recipes:write"]);
      expect(await requireApiToken(ctx, routeRequest(issued.token), { scopes: ["recipes:write"] })).toEqual({
        ok: true,
        value: { userId: alice, tokenId: issued.id, scopes: ["recipes:read", "recipes:write"] },
      });
      const [row] = await query<{ last_used_at: Date | null }>("SELECT last_used_at FROM mcp.access_tokens");
      expect(row?.last_used_at).toEqual(NOW);
    });

    it("refuses a missing header, an unknown token, a revoked one and an expired one", async () => {
      expect((await refusal(routeRequest())).error).toBe("mcp-access.api_token_missing");
      expect((await refusal(routeRequest(`acme_${"a".repeat(43)}`))).error).toBe("mcp-access.api_token_invalid");
      const revoked = await issue(alice);
      expect(await revokeAccessToken(ctx, { userId: alice, tokenId: revoked.id })).toEqual({ ok: true, value: undefined });
      expect((await refusal(routeRequest(revoked.token))).error).toBe("mcp-access.api_token_invalid");
      const expiring = await issue(alice);
      ctx = { ...ctx, clock: createTestClock(new Date(NOW.getTime() + 91 * DAY_MS)) };
      expect((await refusal(routeRequest(expiring.token))).error).toBe("mcp-access.api_token_invalid");
    });

    it("refuses a token without the route's scope with the missing scopes", async () => {
      const issued = await issue(alice, ["recipes:read"]);
      expect(await refusal(routeRequest(issued.token), ["recipes:write"])).toEqual({
        ok: false,
        error: "mcp-access.api_scope_missing",
        missingScopes: ["recipes:write"],
      });
    });

    it("says writes are off when the writes switch keeps a held write scope from the token", async () => {
      await close();
      await setUp(createConfig(API_OPTIONS, { writesOn: false }));
      const issued = await issue(alice, ["recipes:read", "recipes:write"]);
      expect(await refusal(routeRequest(issued.token), ["recipes:write"])).toEqual({
        ok: false,
        error: "mcp-access.api_writes_disabled",
        missingScopes: ["recipes:write"],
      });
      expect((await requireApiToken(ctx, routeRequest(issued.token), { scopes: ["recipes:read"] })).ok).toBe(true);
    });

    it("counts requests per token and refuses over the limit with the wait", async () => {
      await close();
      await setUp(createConfig(API_OPTIONS, { tokenLimit: 2 }));
      const issued = await issue(alice);
      const other = await issue(bob);
      expect((await requireApiToken(ctx, routeRequest(issued.token), { scopes: ["recipes:read"] })).ok).toBe(true);
      expect((await requireApiToken(ctx, routeRequest(issued.token), { scopes: ["recipes:read"] })).ok).toBe(true);
      const limited = await refusal(routeRequest(issued.token));
      expect(limited.error).toBe("security.rate_limited");
      expect("retryAfterSeconds" in limited && limited.retryAfterSeconds).toBeGreaterThan(0);
      // Another token from the same address has its own count.
      expect((await requireApiToken(ctx, routeRequest(other.token), { scopes: ["recipes:read"] })).ok).toBe(true);
    });

    it("refuses an unidentified client before any lookup", async () => {
      const issued = await issue(alice);
      expect((await refusal(routeRequest(issued.token, null))).error).toBe("security.client_unidentified");
    });

    it("answers api_unavailable and logs when the lookup fails", async () => {
      const issued = await issue(alice);
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      ctx = { ...ctx, db: failOn(ctx.db, "select", "connection lost") };
      expect((await refusal(routeRequest(issued.token))).error).toBe("mcp-access.api_unavailable");
      expect(log.mock.calls.flat().join(" ")).toContain("checking an API token failed");
      expect(log.mock.calls.flat().join(" ")).not.toContain(issued.token);
    });

    it("throws for a scope the app does not declare and for missing buckets", async () => {
      await expect(requireApiToken(ctx, routeRequest(), { scopes: ["orders:read"] })).rejects.toThrow(/does not declare: orders:read/);
      await close();
      const config = defineSoftureConfig({
        database: { url: "pglite://" },
        locale: "en",
        timezone: "Europe/Warsaw",
        appOrigin: "http://localhost:3000",
        modules: [
          security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
          auth({ password: { scrypt: { cost: 2 ** 10 } } }),
          mcpAccess(API_OPTIONS),
        ],
      });
      await setUp(config);
      await expect(requireApiToken(ctx, routeRequest(), { scopes: ["recipes:read"] })).rejects.toThrow(/API_TOKEN_RATE_LIMIT_BUCKETS/);
    });
  });

  describe("apiTokenErrorResponse", () => {
    const answer = async (refused: ApiTokenRefusal) => {
      const response = apiTokenErrorResponse(refused);
      return { status: response.status, body: (await response.json()) as unknown, auth: response.headers.get("www-authenticate"), retry: response.headers.get("retry-after"), cache: response.headers.get("cache-control") };
    };

    it("maps each refusal to its status, body and headers", async () => {
      expect(await answer({ ok: false, error: "mcp-access.api_token_missing" })).toEqual({ status: 401, body: { error: "api_token_missing" }, auth: "Bearer", retry: null, cache: "no-store" });
      expect((await answer({ ok: false, error: "mcp-access.api_token_invalid" })).auth).toBe('Bearer error="invalid_token"');
      expect(await answer({ ok: false, error: "mcp-access.api_scope_missing", missingScopes: ["recipes:write"] })).toEqual({
        status: 403,
        body: { error: "api_scope_missing", missingScopes: ["recipes:write"] },
        auth: 'Bearer error="insufficient_scope", scope="recipes:write"',
        retry: null,
        cache: "no-store",
      });
      expect(await answer({ ok: false, error: "security.rate_limited", retryAfterSeconds: 42 })).toEqual({ status: 429, body: { error: "rate_limited" }, auth: null, retry: "42", cache: "no-store" });
      expect((await answer({ ok: false, error: "security.client_unidentified" })).status).toBe(400);
      expect((await answer({ ok: false, error: "mcp-access.api_unavailable" })).status).toBe(503);
    });
  });

  describe("list, privacy and prune", () => {
    it("lists both kinds with their scopes, only for the owner", async () => {
      await issueAccessToken(ctx, { userId: alice, name: "Laptop", canWrite: false });
      ctx = { ...ctx, clock: createTestClock(new Date(NOW.getTime() + 1000)) };
      await issue(alice, ["recipes:read"], "Shortcut");
      await issue(bob);
      const listed = await listAccessTokens(ctx, alice);
      expect(listed.map((token) => [token.name, token.kind, token.scopes])).toEqual([
        ["Shortcut", "api", ["recipes:read"]],
        ["Laptop", "mcp", []],
      ]);
    });

    it("exports the kind and scopes, and the deletion and prune take API tokens too", async () => {
      await issue(alice, ["recipes:read"], "Shortcut");
      const exported = await exportMcpAccessUserData(ctx, alice);
      expect(exported.value.accessTokens.map((token) => [token.name, token.kind, token.scopes])).toEqual([["Shortcut", "api", ["recipes:read"]]]);
      ctx = { ...ctx, clock: createTestClock(new Date(NOW.getTime() + 91 * DAY_MS)) };
      expect(await pruneAccessTokens(ctx)).toBe(1);
    });
  });

  describe("the /tokens entry point", () => {
    it("loads no MCP SDK module", () => {
      const seen = new Set<string>();
      const external: string[] = [];
      const toSource = (from: string, specifier: string) => {
        const base = resolve(dirname(from), specifier).replace(/\.js$/, "");
        return existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`;
      };
      const walk = (file: string) => {
        if (seen.has(file)) return;
        seen.add(file);
        for (const match of readFileSync(file, "utf8").matchAll(/^(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gm)) {
          const specifier = match[1] ?? "";
          if (specifier.startsWith(".")) walk(toSource(file, specifier));
          else external.push(specifier);
        }
      };
      walk(join(import.meta.dirname, "../src/tokens/index.ts"));
      expect(seen.size).toBeGreaterThan(3);
      expect(external.filter((specifier) => specifier.startsWith("@modelcontextprotocol/"))).toEqual([]);
    });
  });
});
