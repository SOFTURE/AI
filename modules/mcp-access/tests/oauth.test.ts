// The OAuth data layer: clients, single-use codes bound to PKCE, grants with rotated refresh
// tokens and replay detection, the configured lifetimes, the connected apps list and pruning.
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  getCodeChallenge,
  hashAccessToken,
  isClientSecretValid,
  issueAccessToken,
  listAccessTokens,
  listOAuthGrants,
  pruneOAuthRecords,
  refreshMcpGrant,
  registerMcpClient,
  revokeOAuthGrant,
  verifyAccessToken,
} from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectApp, createConfig, createTestMcp, createUser, NOW, OAUTH_OPTIONS, REDIRECT_URI, VERIFIER, type TestMcp } from "./support.js";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

describe("the OAuth data layer", () => {
  let test: TestMcp;
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    test = await createTestMcp(createConfig(OAUTH_OPTIONS));
    alice = await createUser(test.database, "alice@example.com");
    bob = await createUser(test.database, "bob@example.com");
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function count(table: string): Promise<number> {
    const result = await test.database.client.query<{ total: number }>(`SELECT count(*)::int AS total FROM mcp.${table}`);
    return result.rows[0]?.total ?? -1;
  }

  async function newCode(client: Awaited<ReturnType<typeof registerMcpClient>>["client"], userId = alice, canWrite = false): Promise<string> {
    return createAuthorizationCode(test.ctx, { clientRowId: client.id, userId, redirectUri: REDIRECT_URI, codeChallenge: getCodeChallenge(VERIFIER), canWrite });
  }

  async function publicClient(name = "Assistant") {
    return (await registerMcpClient(test.ctx, { clientName: name, redirectUris: [REDIRECT_URI], tokenEndpointAuthMethod: "none" })).client;
  }

  describe("registerMcpClient", () => {
    it("gives a public client no secret and a confidential one a secret stored as its hash", async () => {
      const open = await registerMcpClient(test.ctx, { clientName: "Open", redirectUris: [REDIRECT_URI], tokenEndpointAuthMethod: "none" });
      expect(open.clientSecret).toBeNull();
      expect(open.client.clientId).toMatch(/^sftmc_[A-Za-z0-9_-]{22}$/);
      expect(isClientSecretValid(open.client, null)).toBe(true);
      expect(isClientSecretValid(open.client, "anything")).toBe(false);

      const closed = await registerMcpClient(test.ctx, { clientName: "Closed", redirectUris: [REDIRECT_URI], tokenEndpointAuthMethod: "client_secret_basic" });
      expect(closed.clientSecret).toMatch(/^sftmcs_[A-Za-z0-9_-]{43}$/);
      expect(closed.client.clientSecretHash).toBe(hashAccessToken(closed.clientSecret ?? ""));
      expect(isClientSecretValid(closed.client, closed.clientSecret)).toBe(true);
      expect(isClientSecretValid(closed.client, null)).toBe(false);
      expect(isClientSecretValid(closed.client, `${closed.clientSecret ?? ""}x`)).toBe(false);
    });

    it("deletes clients older than a day that nobody connected, and keeps connected ones", async () => {
      const abandoned = await publicClient("Abandoned");
      await connectApp(test.ctx, alice, { clientName: "Kept" });
      test.clock.set(new Date(NOW.getTime() + DAY_MS + 1));
      await publicClient("New");
      const names = await test.database.client.query<{ client_name: string }>("SELECT client_name FROM mcp.oauth_clients ORDER BY client_name");
      expect(names.rows.map((row) => row.client_name)).toEqual(["Kept", "New"]);
      expect(names.rows.some((row) => row.client_name === abandoned.clientName)).toBe(false);
    });
  });

  describe("exchangeAuthorizationCode", () => {
    it("issues an hour-long access token, a refresh token and a grant, storing only hashes", async () => {
      const client = await publicClient();
      const code = await newCode(client, alice, true);
      expect(code).toMatch(/^sftmca_[A-Za-z0-9_-]{43}$/);
      const tokens = await exchangeAuthorizationCode(test.ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER });
      expect(tokens).toEqual({ accessToken: expect.stringMatching(/^sftmcp_/) as string, refreshToken: expect.stringMatching(/^sftmcr_/) as string, expiresIn: 3600, canWrite: true });

      const verified = await verifyAccessToken(test.ctx, tokens?.accessToken ?? "");
      expect(verified).toMatchObject({ userId: alice, canWrite: true, expiresAt: new Date(NOW.getTime() + 60 * MINUTE_MS) });
      expect(verified?.grantId).toEqual(expect.any(String));
      const stored = await test.database.client.query<{ name: string; token_hash: string }>("SELECT name, token_hash FROM mcp.access_tokens");
      expect(stored.rows).toEqual([{ name: "Assistant", token_hash: hashAccessToken(tokens?.accessToken ?? "") }]);
      const grant = await test.database.client.query<{ refresh_token_hash: string }>("SELECT refresh_token_hash FROM mcp.oauth_grants");
      expect(grant.rows).toEqual([{ refresh_token_hash: hashAccessToken(tokens?.refreshToken ?? "") }]);
    });

    it("takes the only registered redirect URI when the client leaves it out", async () => {
      const client = await publicClient();
      expect(await exchangeAuthorizationCode(test.ctx, { code: await newCode(client), client, redirectUri: null, codeVerifier: VERIFIER })).not.toBeNull();
    });

    it.each([
      ["a wrong verifier", { codeVerifier: "w".repeat(43) }],
      ["a verifier that is too short", { codeVerifier: "v".repeat(42) }],
      ["another redirect URI", { redirectUri: "https://assistant.example/other" }],
    ])("refuses %s and burns the code", async (_case, change) => {
      const client = await publicClient();
      const code = await newCode(client);
      expect(await exchangeAuthorizationCode(test.ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER, ...change })).toBeNull();
      expect(await exchangeAuthorizationCode(test.ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER })).toBeNull();
      expect(await count("oauth_grants")).toBe(0);
    });

    it("refuses a code issued to another client", async () => {
      const client = await publicClient();
      const other = await publicClient("Other");
      expect(await exchangeAuthorizationCode(test.ctx, { code: await newCode(client), client: other, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER })).toBeNull();
    });

    it("refuses an expired code", async () => {
      const client = await publicClient();
      const code = await newCode(client);
      test.clock.set(new Date(NOW.getTime() + 10 * MINUTE_MS));
      expect(await exchangeAuthorizationCode(test.ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER })).toBeNull();
    });

    it("follows the configured code lifetime", async () => {
      const ctx = { ...test.ctx, config: createConfig({ ...OAUTH_OPTIONS, oauth: { enabled: true, authorizationCodeLifetimeMinutes: 2 } }) };
      const client = (await registerMcpClient(ctx, { clientName: "Assistant", redirectUris: [REDIRECT_URI], tokenEndpointAuthMethod: "none" })).client;
      const code = await createAuthorizationCode(ctx, { clientRowId: client.id, userId: alice, redirectUri: REDIRECT_URI, codeChallenge: getCodeChallenge(VERIFIER), canWrite: false });
      test.clock.set(new Date(NOW.getTime() + 2 * MINUTE_MS));
      expect(await exchangeAuthorizationCode(ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER })).toBeNull();
    });

    it("revokes the grant when a used code comes back", async () => {
      const client = await publicClient();
      const code = await newCode(client);
      const tokens = await exchangeAuthorizationCode(test.ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER });
      expect(await exchangeAuthorizationCode(test.ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER })).toBeNull();
      expect(await count("oauth_grants")).toBe(0);
      expect(await verifyAccessToken(test.ctx, tokens?.accessToken ?? "")).toBeNull();
    });

    it("replaces the grant on a new consent of the same client, with its tokens", async () => {
      const client = await publicClient();
      const first = await exchangeAuthorizationCode(test.ctx, { code: await newCode(client), client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER });
      const second = await exchangeAuthorizationCode(test.ctx, { code: await newCode(client), client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER });
      expect(await count("oauth_grants")).toBe(1);
      expect(await verifyAccessToken(test.ctx, first?.accessToken ?? "")).toBeNull();
      expect(await verifyAccessToken(test.ctx, second?.accessToken ?? "")).not.toBeNull();
    });

    it("lets two exchanges of one code race and only one win", async () => {
      const client = await publicClient();
      const code = await newCode(client);
      const results = await Promise.all([1, 2].map(() => exchangeAuthorizationCode(test.ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER })));
      expect(results.filter((result) => result !== null)).toHaveLength(1);
    });
  });

  describe("refreshMcpGrant", () => {
    it("rotates the refresh token, issues a new access token and keeps the current one until it expires", async () => {
      const { client, tokens } = await connectApp(test.ctx, alice);
      test.clock.set(new Date(NOW.getTime() + 30 * MINUTE_MS));
      const refreshed = await refreshMcpGrant(test.ctx, { refreshToken: tokens.refreshToken, client });
      expect(refreshed?.refreshToken).not.toBe(tokens.refreshToken);
      expect(await verifyAccessToken(test.ctx, refreshed?.accessToken ?? "")).not.toBeNull();
      expect(await verifyAccessToken(test.ctx, tokens.accessToken)).not.toBeNull();
    });

    it("deletes the grant's spent access tokens on refresh", async () => {
      const { client, tokens } = await connectApp(test.ctx, alice);
      test.clock.set(new Date(NOW.getTime() + 61 * MINUTE_MS));
      await refreshMcpGrant(test.ctx, { refreshToken: tokens.refreshToken, client });
      expect(await count("access_tokens")).toBe(1);
    });

    it("revokes the whole grant when a rotated refresh token is presented again", async () => {
      const { client, tokens } = await connectApp(test.ctx, alice);
      const refreshed = await refreshMcpGrant(test.ctx, { refreshToken: tokens.refreshToken, client });
      expect(await refreshMcpGrant(test.ctx, { refreshToken: tokens.refreshToken, client })).toBeNull();
      expect(await count("oauth_grants")).toBe(0);
      expect(await verifyAccessToken(test.ctx, refreshed?.accessToken ?? "")).toBeNull();
      expect(await refreshMcpGrant(test.ctx, { refreshToken: refreshed?.refreshToken ?? "", client })).toBeNull();
    });

    it("refuses another client's refresh token without touching the grant", async () => {
      const { tokens } = await connectApp(test.ctx, alice);
      const other = await publicClient("Other");
      expect(await refreshMcpGrant(test.ctx, { refreshToken: tokens.refreshToken, client: other })).toBeNull();
      expect(await count("oauth_grants")).toBe(1);
    });

    it("refuses an expired refresh token and counts the lifetime from the last refresh", async () => {
      const { client, tokens } = await connectApp(test.ctx, alice);
      test.clock.set(new Date(NOW.getTime() + 80 * DAY_MS));
      const refreshed = await refreshMcpGrant(test.ctx, { refreshToken: tokens.refreshToken, client });
      expect(refreshed).not.toBeNull();
      test.clock.set(new Date(NOW.getTime() + 160 * DAY_MS));
      expect(await refreshMcpGrant(test.ctx, { refreshToken: refreshed?.refreshToken ?? "", client })).not.toBeNull();
      test.clock.set(new Date(NOW.getTime() + 251 * DAY_MS));
      expect(await refreshMcpGrant(test.ctx, { refreshToken: refreshed?.refreshToken ?? "", client })).toBeNull();
    });

    it("follows the configured access token lifetime", async () => {
      const ctx = { ...test.ctx, config: createConfig({ ...OAUTH_OPTIONS, oauth: { enabled: true, accessTokenLifetimeMinutes: 15 } }) };
      const { tokens } = await connectApp(ctx, alice);
      expect(tokens.expiresIn).toBe(900);
      test.clock.set(new Date(NOW.getTime() + 15 * MINUTE_MS));
      expect(await verifyAccessToken(ctx, tokens.accessToken)).toBeNull();
    });
  });

  describe("connected apps", () => {
    it("lists the owner's grants only, newest first, apart from the hand-issued tokens", async () => {
      await connectApp(test.ctx, alice, { clientName: "First", canWrite: true });
      test.clock.set(new Date(NOW.getTime() + MINUTE_MS));
      await connectApp(test.ctx, alice, { clientName: "Second" });
      await connectApp(test.ctx, bob, { clientName: "Bob's" });
      const issued = await issueAccessToken(test.ctx, { userId: alice, name: "Laptop", canWrite: false });
      expect(issued.ok).toBe(true);

      const grants = await listOAuthGrants(test.ctx, alice);
      expect(grants.map((grant) => [grant.clientName, grant.canWrite])).toEqual([
        ["Second", false],
        ["First", true],
      ]);
      expect((await listAccessTokens(test.ctx, alice)).map((token) => token.name)).toEqual(["Laptop"]);
    });

    it("does not count OAuth access tokens toward the per-account limit", async () => {
      const ctx = { ...test.ctx, config: createConfig({ ...OAUTH_OPTIONS, maxTokensPerUser: 1 }) };
      await connectApp(ctx, alice);
      expect((await issueAccessToken(ctx, { userId: alice, name: "Laptop", canWrite: false })).ok).toBe(true);
    });

    it("records the last use on the grant", async () => {
      const { tokens } = await connectApp(test.ctx, alice);
      test.clock.set(new Date(NOW.getTime() + 5 * MINUTE_MS));
      await verifyAccessToken(test.ctx, tokens.accessToken);
      expect((await listOAuthGrants(test.ctx, alice))[0]?.lastUsedAt).toEqual(new Date(NOW.getTime() + 5 * MINUTE_MS));
    });

    it("revokes a grant with its access tokens, for its owner only", async () => {
      const { tokens } = await connectApp(test.ctx, alice);
      const [grant] = await listOAuthGrants(test.ctx, alice);
      expect(await revokeOAuthGrant(test.ctx, { userId: bob, grantId: grant?.id ?? "" })).toEqual({ ok: false, error: "mcp-access.grant_not_found" });
      expect(await revokeOAuthGrant(test.ctx, { userId: alice, grantId: "not-a-uuid" })).toEqual({ ok: false, error: "mcp-access.grant_not_found" });
      expect(await revokeOAuthGrant(test.ctx, { userId: alice, grantId: grant?.id ?? "" })).toEqual({ ok: true, value: undefined });
      expect(await verifyAccessToken(test.ctx, tokens.accessToken)).toBeNull();
      expect(await count("access_tokens")).toBe(0);
    });
  });

  describe("pruneOAuthRecords", () => {
    it("deletes expired codes, expired grants and abandoned clients", async () => {
      await connectApp(test.ctx, alice);
      const unused = await publicClient("Unused");
      await newCode(unused, bob);
      test.clock.set(new Date(NOW.getTime() + 91 * DAY_MS));
      expect(await pruneOAuthRecords(test.ctx)).toEqual({ codes: 2, grants: 1, clients: 2 });
      expect(await count("access_tokens")).toBe(0);
    });
  });
});
