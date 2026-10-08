// The module definition: its manifest, its options and the constraints of its table.
import { readFileSync } from "node:fs";
import { defineSoftureConfig, toModuleJson } from "@softure-ai/core";
import { MCP_RATE_LIMIT_BUCKETS, mcpAccess } from "@softure-ai/mcp-access";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfig, createTestMcp, createUser, NOW, type TestMcp } from "./support.js";

const HASH = "a".repeat(64);

describe("the mcp-access module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(mcpAccess));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(mcpAccess.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults: no tools, no writes, 90-day tokens, 20 per account", () => {
    expect(mcpAccess({ serverName: "acme" }).options).toEqual({
      serverName: "acme",
      tools: [],
      allowWrites: false,
      tokenLifetimeDays: 90,
      maxTokensPerUser: 20,
      expiryWarningDays: 14,
      resourceOrigins: [],
      oauth: { enabled: false, accessTokenLifetimeMinutes: 60, refreshTokenLifetimeDays: 90, authorizationCodeLifetimeMinutes: 10, metadata: {} },
    });
    expect(mcpAccess({ serverName: "acme" }).routes).toEqual({
      page: "/account/mcp",
      endpoint: "/api/mcp",
      oauthConsent: "/oauth/authorize",
      oauthDecision: "/api/oauth/authorize",
      oauthToken: "/api/oauth/token",
      oauthRegister: "/api/oauth/register",
    });
  });

  it("takes a legacy token pattern and OAuth lifetimes", () => {
    const options = mcpAccess({
      serverName: "acme",
      legacyTokenPattern: /^[0-9a-f]{64}$/,
      oauth: { enabled: true, accessTokenLifetimeMinutes: 30, refreshTokenLifetimeDays: 30, authorizationCodeLifetimeMinutes: 5 },
    }).options as { legacyTokenPattern?: RegExp; oauth: unknown };
    expect(options.legacyTokenPattern?.source).toBe("^[0-9a-f]{64}$");
    expect(options.oauth).toEqual({ enabled: true, accessTokenLifetimeMinutes: 30, refreshTokenLifetimeDays: 30, authorizationCodeLifetimeMinutes: 5, metadata: {} });
  });

  it("refuses a legacy pattern that is not anchored or keeps state, and lifetimes out of range", () => {
    expect(() =>
      mcpAccess({
        serverName: "acme",
        legacyTokenPattern: /[0-9a-f]{64}/,
        oauth: { accessTokenLifetimeMinutes: 4, refreshTokenLifetimeDays: 366, authorizationCodeLifetimeMinutes: 11 },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "mcp-access":',
        "- options.legacyTokenPattern: must be anchored with ^ and $",
        "- options.oauth.accessTokenLifetimeMinutes: Too small: expected number to be >=5",
        "- options.oauth.refreshTokenLifetimeDays: Too big: expected number to be <=365",
        "- options.oauth.authorizationCodeLifetimeMinutes: Too big: expected number to be <=10",
      ].join("\n"),
    );
    expect(() => mcpAccess({ serverName: "acme", legacyTokenPattern: /^[0-9a-f]{64}$/g })).toThrow("- options.legacyTokenPattern: must not use the g or y flag");
    expect(() => mcpAccess({ serverName: "acme", legacyTokenPattern: /^[0-9a-f]{64}$/y })).toThrow("- options.legacyTokenPattern: must not use the g or y flag");
  });

  it("refuses options it cannot run with, listing every problem", () => {
    expect(() =>
      mcpAccess({
        serverName: "Acme App",
        tools: [
          { name: "list orders", access: "read", description: { en: "Lists orders." } },
          { name: "list_orders", access: "read", description: { pl: "Lists orders (pl)." } },
          // @ts-expect-error: a JavaScript config can name an access level that does not exist.
          { name: "delete_all", access: "admin", description: { en: "Deletes." } },
          { name: "list_orders", access: "read", description: { en: "Again." } },
        ],
        tokenLifetimeDays: 0,
        maxTokensPerUser: 1.5,
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "mcp-access":',
        "- options.serverName: must be lowercase letters, digits and inner dashes, at most 64 characters",
        "- options.tools.0.name: must be 1 to 128 of A-Z, a-z, 0-9, _, - and .",
        "- options.tools.1.description: needs at least an en text",
        '- options.tools.2.access: Invalid option: expected one of "read"|"write"',
        "- options.tokenLifetimeDays: Too small: expected number to be >=1",
        "- options.maxTokensPerUser: Invalid input: expected int, received number",
      ].join("\n"),
    );
  });

  it("refuses a tool listed twice", () => {
    expect(() =>
      mcpAccess({
        serverName: "acme",
        tools: [
          { name: "list_orders", access: "read", description: { en: "Lists orders." } },
          { name: "list_orders", access: "read", description: { en: "Again." } },
        ],
      }),
    ).toThrow('- options.tools.1.name: "list_orders" is listed twice');
  });

  it("needs auth, so every token has an owner", () => {
    expect(() =>
      defineSoftureConfig({
        database: { url: "pglite://" },
        locale: "en",
        timezone: "UTC",
        appOrigin: "http://localhost:3000",
        modules: [security({ clientIp: headerIp("x-real-ip"), buckets: MCP_RATE_LIMIT_BUCKETS }), mcpAccess({ serverName: "acme" })],
      }),
    ).toThrow('module "mcp-access" needs module "auth" (^0.1.0), which is not listed');
  });

  it("lists security and auth before mcp-access when sorting, so its migration runs last", () => {
    expect(createConfig().modules.map((module) => module.id)).toEqual(["security", "auth", "mcp-access"]);
  });
});

describe("the access_tokens table", () => {
  let test: TestMcp;
  let userId: string;

  beforeEach(async () => {
    test = await createTestMcp();
    userId = await createUser(test.database, "alice@example.com");
  });
  afterEach(async () => {
    await test.database.close();
  });

  const insert = (values: { name?: string; hash?: string; expiresAt?: Date; user?: string } = {}) =>
    test.database.client.query(
      "INSERT INTO mcp.access_tokens (user_id, name, token_hash, can_write, created_at, expires_at) VALUES ($1, $2, $3, false, $4, $5)",
      [values.user ?? userId, values.name ?? "Laptop", values.hash ?? HASH, NOW, values.expiresAt ?? new Date(NOW.getTime() + 1000)],
    );

  it("accepts a well-formed row", async () => {
    await expect(insert()).resolves.toBeDefined();
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a name with outer spaces", { name: " Laptop" }],
    ["a name over 60 characters", { name: "x".repeat(61) }],
    ["a hash that is not sha256 hex", { hash: "A".repeat(64) }],
    ["an expiry not after the creation", { expiresAt: NOW }],
  ])("rejects %s", async (_case, values) => {
    await expect(insert(values)).rejects.toThrow(/check constraint/);
  });

  it("keeps each hash unique", async () => {
    await insert();
    await expect(insert()).rejects.toThrow(/access_tokens_token_hash_key/);
  });

  it("refuses a token for an account that does not exist", async () => {
    await expect(insert({ user: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow(/foreign key/);
  });
});

describe("the OAuth tables", () => {
  let test: TestMcp;
  let userId: string;

  beforeEach(async () => {
    test = await createTestMcp();
    userId = await createUser(test.database, "alice@example.com");
  });
  afterEach(async () => {
    await test.database.close();
  });

  const insertClient = (values: { name?: string; method?: string; secretHash?: string | null; uris?: string } = {}) =>
    test.database.client.query<{ id: string }>(
      "INSERT INTO mcp.oauth_clients (client_id, client_name, redirect_uris, token_endpoint_auth_method, client_secret_hash, created_at) VALUES ($1, $2, $3::jsonb, $4, $5, $6) RETURNING id",
      [`client-${Math.random()}`, values.name ?? "Claude", values.uris ?? '["https://claude.ai/cb"]', values.method ?? "none", values.secretHash === undefined ? null : values.secretHash, NOW],
    );

  it("accepts a public and a confidential client", async () => {
    await expect(insertClient()).resolves.toBeDefined();
    await expect(insertClient({ method: "client_secret_basic", secretHash: HASH })).resolves.toBeDefined();
  });

  it.each([
    ["a name over 60 characters", { name: "x".repeat(61) }],
    ["a public client with a secret", { secretHash: HASH }],
    ["a confidential client without one", { method: "client_secret_post" }],
    ["an unknown auth method", { method: "private_key_jwt" }],
    ["no redirect URI", { uris: "[]" }],
    ["redirect URIs that are not a list", { uris: '"https://claude.ai/cb"' }],
  ])("rejects a client with %s", async (_case, values) => {
    await expect(insertClient(values)).rejects.toThrow(/check constraint/);
  });

  it("keeps one grant per account and client", async () => {
    const client = (await insertClient()).rows[0]?.id;
    const insertGrant = (hash: string) =>
      test.database.client.query(
        "INSERT INTO mcp.oauth_grants (user_id, client_id, can_write, refresh_token_hash, refresh_expires_at, created_at) VALUES ($1, $2, false, $3, $4, $4)",
        [userId, client, hash, NOW],
      );
    await insertGrant(HASH);
    await expect(insertGrant("b".repeat(64))).rejects.toThrow(/oauth_grants_user_id_client_id_key/);
  });

  it("refuses a code challenge that is not S256-shaped", async () => {
    const client = (await insertClient()).rows[0]?.id;
    await expect(
      test.database.client.query(
        "INSERT INTO mcp.oauth_authorization_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, can_write, expires_at, created_at) VALUES ($1, $2, $3, 'https://claude.ai/cb', 'plain', false, $4, $5)",
        [HASH, client, userId, new Date(NOW.getTime() + 1000), NOW],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("the mcp-access health check", () => {
  it("passes once the tables exist and throws without them", async () => {
    const test = await createTestMcp();
    try {
      expect(await mcpAccess({ serverName: "acme" }).health?.(test.ctx)).toEqual({ ok: true, value: undefined });
      await test.database.client.query("DROP TABLE mcp.oauth_grants CASCADE");
      await expect(mcpAccess({ serverName: "acme" }).health?.(test.ctx)).rejects.toThrow(/oauth_grants|grant_id/);
      await test.database.client.query("DROP TABLE mcp.access_tokens");
      await expect(mcpAccess({ serverName: "acme" }).health?.(test.ctx)).rejects.toThrow(/mcp\.access_tokens/);
    } finally {
      await test.database.close();
    }
  });
});
