// A password reset or change ends every token, grant and code the account had before it: whoever took the account
// over and issued them must not keep a way in after the owner takes it back.
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  getCodeChallenge,
  issueAccessToken,
  listAccessTokens,
  listOAuthGrants,
  pruneAccessTokens,
  pruneOAuthRecords,
  refreshMcpGrant,
  registerMcpClient,
  verifyAccessToken,
} from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectApp, createConfig, createTestMcp, createUser, NOW, OAUTH_OPTIONS, REDIRECT_URI, VERIFIER, type TestMcp } from "./support.js";

const MINUTE_MS = 60_000;

describe("a password change", () => {
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

  async function changePassword(userId: string, at: Date): Promise<void> {
    await test.database.client.query("UPDATE auth.users SET password_changed_at = $2 WHERE id = $1", [userId, at]);
  }

  async function issue(userId: string, name = "Laptop") {
    const result = await issueAccessToken(test.ctx, { userId, name, canWrite: false });
    if (!result.ok) throw new Error(`issue failed: ${result.error}`);
    return result.value;
  }

  async function count(table: string): Promise<number> {
    const result = await test.database.client.query<{ total: number }>(`SELECT count(*)::int AS total FROM mcp.${table}`);
    return result.rows[0]?.total ?? -1;
  }

  it("ends a hand-issued token issued before it and leaves it out of the list, but keeps one issued after it", async () => {
    const before = await issue(alice, "Before");
    const bobs = await issue(bob, "Bob's");
    test.clock.set(new Date(NOW.getTime() + MINUTE_MS));
    await changePassword(alice, test.clock.now());
    const after = await issue(alice, "After");

    expect(await verifyAccessToken(test.ctx, before.token)).toBeNull();
    expect((await verifyAccessToken(test.ctx, after.token))?.userId).toBe(alice);
    expect((await verifyAccessToken(test.ctx, bobs.token))?.userId).toBe(bob);
    expect((await listAccessTokens(test.ctx, alice)).map((token) => token.name)).toEqual(["After"]);
  });

  it("keeps a token issued in the same instant as the change", async () => {
    const issued = await issue(alice);
    await changePassword(alice, NOW);
    expect((await verifyAccessToken(test.ctx, issued.token))?.userId).toBe(alice);
  });

  it("ends a connected app: its access token, its refresh token and its place in the connected apps list", async () => {
    const { client, tokens } = await connectApp(test.ctx, alice);
    test.clock.set(new Date(NOW.getTime() + MINUTE_MS));
    await changePassword(alice, test.clock.now());

    expect(await verifyAccessToken(test.ctx, tokens.accessToken)).toBeNull();
    expect(await refreshMcpGrant(test.ctx, { refreshToken: tokens.refreshToken, client })).toBeNull();
    expect(await listOAuthGrants(test.ctx, alice)).toEqual([]);
  });

  it("keeps a connected app of another account", async () => {
    const { client, tokens } = await connectApp(test.ctx, bob);
    test.clock.set(new Date(NOW.getTime() + MINUTE_MS));
    await changePassword(alice, test.clock.now());
    expect(await refreshMcpGrant(test.ctx, { refreshToken: tokens.refreshToken, client })).not.toBeNull();
  });

  it("refuses a code consented to before it", async () => {
    const { client } = await registerMcpClient(test.ctx, { clientName: "Assistant", redirectUris: [REDIRECT_URI], tokenEndpointAuthMethod: "none" });
    const code = await createAuthorizationCode(test.ctx, { clientRowId: client.id, userId: alice, redirectUri: REDIRECT_URI, codeChallenge: getCodeChallenge(VERIFIER), canWrite: false });
    test.clock.set(new Date(NOW.getTime() + MINUTE_MS));
    await changePassword(alice, test.clock.now());
    expect(await exchangeAuthorizationCode(test.ctx, { code, client, redirectUri: REDIRECT_URI, codeVerifier: VERIFIER })).toBeNull();
    expect(await count("oauth_grants")).toBe(0);
  });

  it("lets the prune jobs delete what it ended, and nothing else", async () => {
    await issue(alice, "Before");
    await connectApp(test.ctx, alice);
    await issue(bob, "Bob's");
    test.clock.set(new Date(NOW.getTime() + MINUTE_MS));
    await changePassword(alice, test.clock.now());
    await issue(alice, "After");

    expect(await pruneOAuthRecords(test.ctx)).toEqual({ codes: 0, grants: 1, clients: 0 });
    expect(await pruneAccessTokens(test.ctx)).toBe(1);
    const names = await test.database.client.query<{ name: string }>("SELECT name FROM mcp.access_tokens ORDER BY name");
    expect(names.rows.map((row) => row.name)).toEqual(["After", "Bob's"]);
  });
});
