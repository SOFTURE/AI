// The module definition: its manifest, its options and the constraints of its tables.
import { readFileSync } from "node:fs";
import { connections } from "@softure-ai/connections";
import { defineSoftureConfig, toModuleJson } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestConnections, NOW, type TestConnections } from "./support.js";

const OAUTH = {
  kind: "oauth",
  id: "google",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
} as const;

describe("the connections module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(connections));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(connections.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults", () => {
    expect(connections().options).toEqual({
      providers: [],
      panelRole: "admin",
      refreshSkewSeconds: 300,
      expiringWithinHours: 72,
      refreshLeaseSeconds: 30,
      refreshWait: { attempts: 40, intervalMs: 250 },
      stateTtlMinutes: 10,
      httpTimeoutMs: 10_000,
    });
    expect(connections({ providers: [OAUTH, { kind: "api_key", id: "raindrop" }] }).options.providers).toEqual([
      {
        ...OAUTH,
        accounts: ["default"],
        scopes: [],
        scopeSeparator: " ",
        clientAuth: "body",
        authorizeParams: {},
        pkce: true,
        rotatesRefreshToken: false,
      },
      { kind: "api_key", id: "raindrop", accounts: ["default"] },
    ]);
  });

  it("refuses providers it cannot run with, listing every problem", () => {
    expect(() =>
      connections({
        providers: [
          { ...OAUTH, id: "Google" },
          { ...OAUTH, authorizeUrl: "http://accounts.example.com/auth" },
          { ...OAUTH, id: "both", clientId: "abc" },
          { ...OAUTH, id: "public", clientSecretEnv: undefined, pkce: false },
          { ...OAUTH, id: "reserved", authorizeParams: { state: "x", access_type: "offline" } },
          { kind: "api_key", id: "raindrop", accounts: ["work", "work"] },
          { kind: "api_key", id: "raindrop" },
          { ...OAUTH, id: "lower-env", clientSecretEnv: "google_secret" },
        ],
        refreshLeaseSeconds: 5,
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "connections":',
        "- options.providers.0.id: must be kebab-case, e.g. google-calendar",
        "- options.providers.1.authorizeUrl: must be an https URL (http only on localhost)",
        "- options.providers.7.clientSecretEnv: must be an environment variable name such as GOOGLE_CLIENT_SECRET",
      ].join("\n"),
    );
    expect(() =>
      connections({
        providers: [
          { ...OAUTH, id: "both", clientId: "abc" },
          { ...OAUTH, id: "public", clientSecretEnv: undefined, pkce: false },
          { ...OAUTH, id: "reserved", authorizeParams: { state: "x", access_type: "offline" } },
          { kind: "api_key", id: "raindrop", accounts: ["work", "work"] },
          { kind: "api_key", id: "raindrop" },
        ],
        refreshLeaseSeconds: 5,
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "connections":',
        "- options.providers.0.clientId: give exactly one of clientId and clientIdEnv",
        "- options.providers.1.pkce: a public client (no clientSecretEnv) needs pkce",
        "- options.providers.2.authorizeParams.state: is set by the module",
        "- options.providers.3.accounts: must not repeat an account",
        '- options.providers.4.id: "raindrop" is declared twice',
        "- options.refreshLeaseSeconds: must be longer than httpTimeoutMs",
      ].join("\n"),
    );
  });

  it("takes http endpoints on localhost, for a provider emulator", () => {
    expect(() => connections({ providers: [{ ...OAUTH, authorizeUrl: "http://localhost:9099/auth", tokenUrl: "http://127.0.0.1:9099/token" }] })).not.toThrow();
  });

  it("needs the auth module, so the page is never mounted without a role check", () => {
    expect(() =>
      defineSoftureConfig({ database: { url: "pglite://" }, locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [connections()] }),
    ).toThrow('module "connections" needs module "auth" (^0.2.0), which is not listed');
  });
});

describe("the connections tables", () => {
  let test: TestConnections;

  beforeEach(async () => {
    test = await createTestConnections();
  });
  afterEach(async () => {
    await test.database.close();
  });

  const insert = (overrides: Record<string, unknown> = {}) => {
    const row = {
      provider: "fake",
      account_id: "default",
      kind: "oauth",
      status: "connected",
      key_id: "test",
      credentials: "v1.test.x.y",
      has_refresh_token: false,
      expires_at: null,
      lease_id: null,
      lease_until: null,
      last_error: null,
      last_error_at: null,
      ...overrides,
    };
    return test.database.client.query(
      `INSERT INTO connections.accounts (provider, account_id, kind, status, key_id, credentials, has_refresh_token, expires_at, lease_id, lease_until, last_error, last_error_at, connected_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
      [row.provider, row.account_id, row.kind, row.status, row.key_id, row.credentials, row.has_refresh_token, row.expires_at, row.lease_id, row.lease_until, row.last_error, row.last_error_at, NOW],
    );
  };

  it("accepts a well-formed row", async () => {
    await expect(insert()).resolves.toBeDefined();
  });

  it.each([
    ["an unknown kind", { kind: "token" }],
    ["an unknown status", { status: "broken" }],
    ["an uppercase provider", { provider: "Fake" }],
    ["an account with a space", { account_id: "my work" }],
    ["a key id with a dot", { key_id: "a.b" }],
    ["an empty credential", { credentials: "" }],
    ["a lease id without an end", { lease_id: "1c3f8a1e-2b3a-4c5d-8e9f-0a1b2c3d4e5f" }],
    ["an error without a date", { last_error: "connections.refresh_failed" }],
    ["an error that is not a code", { last_error: "Token abc expired", last_error_at: NOW }],
    ["an API key with an expiry", { kind: "api_key", expires_at: NOW }],
  ])("rejects %s", async (_case, overrides) => {
    await expect(insert(overrides)).rejects.toThrow(/check constraint/);
  });

  it("keeps one row per provider account", async () => {
    await insert();
    await expect(insert()).rejects.toThrow(/duplicate key/);
  });

  it("refuses a pending authorization that expires before it starts", async () => {
    await expect(
      test.database.client.query(
        "INSERT INTO connections.oauth_states (state_hash, provider, account_id, key_id, created_by, created_at, expires_at) VALUES ($1, 'fake', 'default', 'test', 'u', $2, $2)",
        ["a".repeat(43), NOW],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("the connections health check", () => {
  it("passes once the tables exist and throws without them", async () => {
    const test = await createTestConnections();
    try {
      expect(await connections().health?.(test.ctx)).toEqual({ ok: true, value: undefined });
      await test.database.client.query("DROP TABLE connections.oauth_states");
      await expect(connections().health?.(test.ctx)).rejects.toThrow(/oauth_states/);
    } finally {
      await test.database.close();
    }
  });
});
