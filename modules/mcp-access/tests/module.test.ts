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
    });
    expect(mcpAccess({ serverName: "acme" }).routes).toEqual({ page: "/account/mcp", endpoint: "/api/mcp" });
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
    ).toThrow('module "mcp-access" needs module "auth" (^0.0.0), which is not listed');
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

describe("the mcp-access health check", () => {
  it("passes once the table exists and throws without it", async () => {
    const test = await createTestMcp();
    try {
      expect(await mcpAccess({ serverName: "acme" }).health?.(test.ctx)).toEqual({ ok: true, value: undefined });
      await test.database.client.query("DROP TABLE mcp.access_tokens");
      await expect(mcpAccess({ serverName: "acme" }).health?.(test.ctx)).rejects.toThrow(/mcp\.access_tokens/);
    } finally {
      await test.database.close();
    }
  });
});
