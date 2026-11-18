// Users' own OAuth grants against the fake provider: the state and PKCE secrets, the consent URL, the code exchange,
// refreshes (plain and rotating), revocation in both styles, sealing a grant to its user, and every failure as a code.
import { createTestClock } from "@softure-ai/core";
import { createFakeOAuthProvider, createTestKeyring, type FakeOAuthProviderOptions } from "@softure-ai/connections/testing";
import {
  buildUserAuthorizationUrl,
  createCodeChallenge,
  createUserOAuthState,
  defineUserOAuthProvider,
  exchangeUserCode,
  hashUserOAuthState,
  openUserSecret,
  readKeyring,
  refreshUserAccessToken,
  revokeUserGrant,
  sealUserSecret,
} from "@softure-ai/connections/user-oauth";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const REDIRECT_URI = "https://app.example/panel/source/callback";
const NOW = new Date("2026-11-18T10:00:00Z");

function setUp(options: FakeOAuthProviderOptions = {}) {
  const fake = createFakeOAuthProvider({ scopes: ["files.read"], ...options });
  const provider = defineUserOAuthProvider(fake.user.definition);
  const clock = createTestClock(NOW);
  return { fake, provider, client: fake.user.client, call: { fetch: fake.fetch, clock } };
}

/** Starts an authorization, consents at the fake and exchanges the callback's code, as an app's callback would. */
async function connect(setup: ReturnType<typeof setUp>) {
  const secrets = await createUserOAuthState();
  const url = await buildUserAuthorizationUrl(setup.provider, setup.client, { redirectUri: REDIRECT_URI, state: secrets.state, codeVerifier: secrets.codeVerifier });
  const callback = setup.fake.consent(url.toString());
  expect(callback.searchParams.get("state")).toBe(secrets.state);
  return exchangeUserCode(setup.provider, setup.client, { code: callback.searchParams.get("code") ?? "", redirectUri: REDIRECT_URI, codeVerifier: secrets.codeVerifier }, setup.call);
}

describe("user OAuth state", () => {
  it("creates a 43-character state, its hex sha256 and a verifier, fresh each time", async () => {
    const first = await createUserOAuthState();
    const second = await createUserOAuthState();
    expect(first.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.stateHash).toBe(createHash("sha256").update(first.state).digest("hex"));
    expect(await hashUserOAuthState(first.state)).toBe(first.stateHash);
    expect(second.state).not.toBe(first.state);
    expect(second.codeVerifier).not.toBe(first.codeVerifier);
  });

  it("computes the RFC 7636 S256 challenge", async () => {
    // RFC 7636, appendix B.
    expect(await createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("defineUserOAuthProvider", () => {
  const base = { id: "dropbox", authorizeUrl: "https://www.dropbox.com/oauth2/authorize", tokenUrl: "https://api.dropboxapi.com/oauth2/token" };

  it("applies the defaults", () => {
    expect(defineUserOAuthProvider(base)).toEqual({ ...base, scopes: [], scopeSeparator: " ", clientAuth: "body", authorizeParams: {}, pkce: true, rotatesRefreshToken: false });
  });

  it("refuses a plain http endpoint off loopback, a bad id and a parameter the flow sets", () => {
    expect(() => defineUserOAuthProvider({ ...base, tokenUrl: "http://api.example/token" })).toThrow("defineUserOAuthProvider: tokenUrl must be an https URL");
    expect(() => defineUserOAuthProvider({ ...base, id: "Drop Box" })).toThrow("defineUserOAuthProvider: id must be kebab-case");
    expect(() => defineUserOAuthProvider({ ...base, authorizeParams: { state: "x" } })).toThrow("defineUserOAuthProvider: authorizeParams.state is set by the flow");
    expect(defineUserOAuthProvider({ ...base, tokenUrl: "http://127.0.0.1:4010/token" }).tokenUrl).toBe("http://127.0.0.1:4010/token");
  });
});

describe("buildUserAuthorizationUrl", () => {
  it("names the client, the redirect, the scopes, the state, the S256 challenge and the provider's own parameters", async () => {
    const provider = defineUserOAuthProvider({
      id: "dropbox",
      authorizeUrl: "https://www.dropbox.com/oauth2/authorize",
      tokenUrl: "https://api.dropboxapi.com/oauth2/token",
      scopes: ["files.metadata.read", "files.content.read"],
      authorizeParams: { token_access_type: "offline" },
    });
    const url = await buildUserAuthorizationUrl(provider, { clientId: "app-key" }, { redirectUri: REDIRECT_URI, state: "the-state", codeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" });
    expect(`${url.origin}${url.pathname}`).toBe("https://www.dropbox.com/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      token_access_type: "offline",
      response_type: "code",
      client_id: "app-key",
      redirect_uri: REDIRECT_URI,
      state: "the-state",
      scope: "files.metadata.read files.content.read",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "S256",
    });
  });

  it("requires a verifier when the provider runs PKCE and sends no challenge when it does not", async () => {
    const { provider, client } = setUp();
    await expect(buildUserAuthorizationUrl(provider, client, { redirectUri: REDIRECT_URI, state: "s" })).rejects.toThrow("a codeVerifier is required");
    const withoutPkce = defineUserOAuthProvider({ ...setUp().fake.user.definition, pkce: false });
    const url = await buildUserAuthorizationUrl(withoutPkce, client, { redirectUri: REDIRECT_URI, state: "s" });
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });
});

describe("exchangeUserCode", () => {
  it("answers the grant with its expiry, scopes and the provider's own identifiers, never a token field", async () => {
    const setup = setUp({ answerFields: { account_id: "dbid:AAH4f99", uid: "12345" }, refreshTokenTtlSeconds: 86_400 });
    const grant = await connect(setup);
    if (!grant.ok) throw new Error(grant.error);
    expect(grant.value.accessToken).toMatch(/^at-/);
    expect(grant.value.refreshToken).toMatch(/^rt-/);
    expect(grant.value.tokenType).toBe("Bearer");
    expect(grant.value.expiresAt).toEqual(new Date("2026-11-18T11:00:00Z"));
    expect(grant.value.refreshExpiresAt).toEqual(new Date("2026-11-19T10:00:00Z"));
    expect(grant.value.scopes).toEqual(["files.read"]);
    expect(grant.value.fields).toEqual({ account_id: "dbid:AAH4f99", uid: "12345" });
    expect(setup.fake.calls.lastForm?.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("lists the scopes the user actually granted", async () => {
    const grant = await connect(setUp({ scopes: ["read", "write"], grantedScopes: ["read"] }));
    expect(grant.ok && grant.value.scopes).toEqual(["read"]);
  });

  it("sends the client as HTTP Basic when the provider asks for it", async () => {
    const setup = setUp({ clientAuth: "basic" });
    const grant = await connect(setup);
    expect(grant.ok).toBe(true);
    expect(setup.fake.calls.lastAuthorization).toBe(`Basic ${Buffer.from("fake-client:fake-client-secret").toString("base64")}`);
    expect(setup.fake.calls.lastForm?.has("client_secret")).toBe(false);
  });

  it("is rejected for a wrong verifier or a used code, and unavailable when the provider is down", async () => {
    const setup = setUp();
    const secrets = await createUserOAuthState();
    const url = await buildUserAuthorizationUrl(setup.provider, setup.client, { redirectUri: REDIRECT_URI, state: secrets.state, codeVerifier: secrets.codeVerifier });
    const code = setup.fake.consent(url.toString()).searchParams.get("code") ?? "";
    const wrong = await exchangeUserCode(setup.provider, setup.client, { code, redirectUri: REDIRECT_URI, codeVerifier: "x".repeat(43) }, setup.call);
    expect(wrong).toEqual({ ok: false, error: "connections.user_oauth_rejected", status: 400, oauthError: "invalid_grant" });
    setup.fake.failNext("unavailable");
    const down = await connect(setup);
    expect(down).toEqual({ ok: false, error: "connections.user_oauth_unavailable", status: 503, oauthError: null });
  });

  it("is rejected for a wrong client secret", async () => {
    const setup = setUp();
    const secrets = await createUserOAuthState();
    const url = await buildUserAuthorizationUrl(setup.provider, setup.client, { redirectUri: REDIRECT_URI, state: secrets.state, codeVerifier: secrets.codeVerifier });
    const code = setup.fake.consent(url.toString()).searchParams.get("code") ?? "";
    const answer = await exchangeUserCode(setup.provider, { clientId: setup.client.clientId, clientSecret: "wrong" }, { code, redirectUri: REDIRECT_URI, codeVerifier: secrets.codeVerifier }, setup.call);
    expect(answer).toEqual({ ok: false, error: "connections.user_oauth_rejected", status: 401, oauthError: "invalid_client" });
  });
});

describe("refreshUserAccessToken", () => {
  it("answers a fresh access token and keeps the refresh token of a provider that does not rotate", async () => {
    const setup = setUp();
    const grant = await connect(setup);
    if (!grant.ok || grant.value.refreshToken === null) throw new Error("no grant");
    const refreshed = await refreshUserAccessToken(setup.provider, setup.client, grant.value.refreshToken, setup.call);
    if (!refreshed.ok) throw new Error(refreshed.error);
    expect(refreshed.value.accessToken).not.toBe(grant.value.accessToken);
    expect(setup.fake.isAccessTokenValid(refreshed.value.accessToken)).toBe(true);
    expect(refreshed.value.refreshToken).toBe(grant.value.refreshToken);
  });

  it("answers the new refresh token of a rotating provider, and the old one is dead", async () => {
    const setup = setUp({ rotatesRefreshToken: true });
    const grant = await connect(setup);
    if (!grant.ok || grant.value.refreshToken === null) throw new Error("no grant");
    const refreshed = await refreshUserAccessToken(setup.provider, setup.client, grant.value.refreshToken, setup.call);
    if (!refreshed.ok) throw new Error(refreshed.error);
    expect(refreshed.value.refreshToken).not.toBe(grant.value.refreshToken);
    const again = await refreshUserAccessToken(setup.provider, setup.client, grant.value.refreshToken, setup.call);
    expect(again).toEqual({ ok: false, error: "connections.user_oauth_reconnect_required", status: 400, oauthError: "invalid_grant" });
  });

  it("needs a reconnect once the user revoked the app, and is retryable on a rate limit", async () => {
    const setup = setUp();
    const grant = await connect(setup);
    if (!grant.ok || grant.value.refreshToken === null) throw new Error("no grant");
    setup.fake.failNext("rate_limited");
    expect(await refreshUserAccessToken(setup.provider, setup.client, grant.value.refreshToken, setup.call)).toEqual({
      ok: false,
      error: "connections.user_oauth_unavailable",
      status: 429,
      oauthError: null,
    });
    setup.fake.revokeGrant();
    const dead = await refreshUserAccessToken(setup.provider, setup.client, grant.value.refreshToken, setup.call);
    expect(dead.ok || dead.error).toBe("connections.user_oauth_reconnect_required");
  });
});

describe("revokeUserGrant", () => {
  it("revokes through RFC 7009 with the client's credentials", async () => {
    const setup = setUp();
    const grant = await connect(setup);
    if (!grant.ok || grant.value.refreshToken === null) throw new Error("no grant");
    expect(await revokeUserGrant(setup.provider, setup.client, grant.value.refreshToken, setup.call)).toBe(true);
    expect(setup.fake.calls.lastForm?.get("client_id")).toBe("fake-client");
    const after = await refreshUserAccessToken(setup.provider, setup.client, grant.value.refreshToken, setup.call);
    expect(after.ok || after.error).toBe("connections.user_oauth_reconnect_required");
  });

  it("revokes with the bearer access token in the bearer style", async () => {
    const setup = setUp({ revokeStyle: "bearer" });
    const grant = await connect(setup);
    if (!grant.ok) throw new Error(grant.error);
    expect(await revokeUserGrant(setup.provider, setup.client, grant.value.accessToken, setup.call)).toBe(true);
    expect(setup.fake.calls.lastAuthorization).toBe(`Bearer ${grant.value.accessToken}`);
    expect(setup.fake.isAccessTokenValid(grant.value.accessToken)).toBe(false);
  });

  it("answers false without a revocation endpoint or when the provider is down", async () => {
    const setup = setUp();
    const withoutRevoke = defineUserOAuthProvider({ ...setup.fake.user.definition, revoke: undefined });
    expect(await revokeUserGrant(withoutRevoke, setup.client, "rt-x", setup.call)).toBe(false);
    setup.fake.failNext("unavailable");
    expect(await revokeUserGrant(setup.provider, setup.client, "rt-x", setup.call)).toBe(false);
  });
});

describe("sealing a user's grant", () => {
  const keyringResult = readKeyring(createTestKeyring(["k1"]));
  if (!keyringResult.ok) throw new Error(keyringResult.error);
  const keyring = keyringResult.value;
  const owner = { userId: "user-1", provider: "dropbox" };

  it("opens for the same user and provider only", () => {
    const sealed = sealUserSecret(keyring, owner, "rt-secret");
    expect(sealed).not.toContain("rt-secret");
    expect(openUserSecret(keyring, owner, sealed)).toEqual({ ok: true, value: "rt-secret" });
    expect(openUserSecret(keyring, { ...owner, userId: "user-2" }, sealed)).toEqual({ ok: false, error: "connections.secret_unreadable" });
    expect(openUserSecret(keyring, { ...owner, provider: "github" }, sealed)).toEqual({ ok: false, error: "connections.secret_unreadable" });
    expect(openUserSecret(keyring, { ...owner, name: "work" }, sealed)).toEqual({ ok: false, error: "connections.secret_unreadable" });
  });

  it("keeps two connections of one user apart by name, and does not confuse a separator inside an id", () => {
    const work = sealUserSecret(keyring, { ...owner, name: "work" }, "rt-work");
    expect(openUserSecret(keyring, { ...owner, name: "work" }, work)).toEqual({ ok: true, value: "rt-work" });
    const slashed = sealUserSecret(keyring, { userId: "a/b", provider: "c" }, "rt");
    expect(openUserSecret(keyring, { userId: "a", provider: "b/c" }, slashed)).toEqual({ ok: false, error: "connections.secret_unreadable" });
  });

  it("does not open under a keyring without the sealing key", () => {
    const other = readKeyring(createTestKeyring(["k2"]));
    if (!other.ok) throw new Error(other.error);
    expect(openUserSecret(other.value, owner, sealUserSecret(keyring, owner, "rt"))).toEqual({ ok: false, error: "connections.key_unknown" });
  });
});
