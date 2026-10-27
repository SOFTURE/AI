// OpenID Connect sign-in against the fake provider: the whole flow, the account mapping and every refusal.
import { completeOidcSignIn, findSessionUser, registerUser, startOidcSignIn } from "@softure-ai/auth/server";
import { createFakeOidcProvider, type FakeOidcProvider, type FakeOidcProviderOptions, type FakeOidcUser, type FakeSignInOptions } from "@softure-ai/auth/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createTestAuth, NOW, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

const ADA: FakeOidcUser = { subject: "sub-ada", email: "ada@example.com" };

interface Setup {
  readonly test: TestAuth;
  readonly fake: FakeOidcProvider;
  readonly ctx: TestAuth["ctx"] & { readonly env: Readonly<Record<string, string>> };
}

let open: TestAuth | undefined;

async function setUp(fakeOptions: Omit<FakeOidcProviderOptions, "clock"> = {}, config: ConfigOptions["auth"] = {}): Promise<Setup> {
  // The clock is created by createTestAuth; the fake reads it lazily through this holder.
  const clockHolder: { now: () => Date } = { now: () => NOW };
  const fake = createFakeOidcProvider({ ...fakeOptions, clock: { now: () => clockHolder.now() } });
  const test = await createTestAuth({ auth: { ...config, oidc: { providers: [fake.definition], fetch: fake.fetch } } });
  clockHolder.now = () => test.clock.now();
  open = test;
  return { test, fake, ctx: { ...test.ctx, env: fake.env } };
}

afterEach(async () => {
  await open?.database.close();
  open = undefined;
  vi.restoreAllMocks();
});

async function signIn(setup: Setup, user: FakeOidcUser = ADA, options: FakeSignInOptions = {}, next?: string) {
  const started = await startOidcSignIn(setup.ctx, { provider: "fake", next, clientKey: CLIENT });
  if (!started.ok) throw new Error(started.error);
  const callback = setup.fake.signIn(started.value.url, user, options);
  return completeOidcSignIn(setup.ctx, {
    provider: "fake",
    params: { state: callback.searchParams.get("state"), code: callback.searchParams.get("code"), error: callback.searchParams.get("error") },
    browserState: started.value.state,
    clientKey: CLIENT,
  });
}

async function countRows(test: TestAuth, table: string): Promise<number> {
  const result = await test.database.client.query<{ count: number }>(`SELECT count(*)::int AS count FROM auth.${table}`);
  return result.rows[0]?.count ?? 0;
}

describe("startOidcSignIn", () => {
  it("answers the provider's authorize URL with PKCE S256, a state, a nonce and the callback on appOrigin", async () => {
    const setup = await setUp();
    const started = await startOidcSignIn(setup.ctx, { provider: "fake", next: "/reports?week=3", clientKey: CLIENT });
    if (!started.ok) throw new Error(started.error);
    const url = new URL(started.value.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://fake-oidc.test/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "fake-client",
      redirect_uri: "http://localhost:3000/api/auth/oidc/fake/callback",
      scope: "openid email profile",
      state: started.value.state,
      nonce: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as unknown,
      code_challenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as unknown,
      code_challenge_method: "S256",
    });
    expect(started.value.maxAgeSeconds).toBe(600);
    const rows = await setup.test.database.client.query<{ state_hash: string; next_path: string }>("SELECT state_hash, next_path FROM auth.oidc_states");
    expect(rows.rows).toEqual([{ state_hash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown, next_path: "/reports?week=3" }]);
    expect(rows.rows[0]?.state_hash).not.toContain(started.value.state);
  });

  it("sends the provider's extra authorize parameters and scopes, and keeps only a path on this app as next", async () => {
    const fake = createFakeOidcProvider();
    const test = await createTestAuth({
      auth: { oidc: { providers: [{ ...fake.definition, scopes: ["profile", "openid"], authorizeParams: { prompt: "select_account", hd: "example.com" } }], fetch: fake.fetch } },
    });
    open = test;
    const started = await startOidcSignIn({ ...test.ctx, env: fake.env }, { provider: "fake", next: "https://evil.test/", clientKey: CLIENT });
    if (!started.ok) throw new Error(started.error);
    const query = new URL(started.value.url).searchParams;
    expect([query.get("scope"), query.get("prompt"), query.get("hd")]).toEqual(["openid email profile", "select_account", "example.com"]);
    const rows = await test.database.client.query<{ next_path: string }>("SELECT next_path FROM auth.oidc_states");
    expect(rows.rows).toEqual([{ next_path: "/" }]);
  });

  it("refuses an unknown provider, a missing client id and a discovery document that names another issuer or http endpoints", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const setup = await setUp();
    expect(await startOidcSignIn(setup.ctx, { provider: "other", clientKey: CLIENT })).toEqual({ ok: false, error: "auth.oidc_failed" });
    expect(await startOidcSignIn({ ...setup.ctx, env: {} }, { provider: "fake", clientKey: CLIENT })).toEqual({ ok: false, error: "auth.oidc_failed" });
    expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: OpenID Connect sign-in with fake failed: FAKE_OIDC_CLIENT_ID is not set");

    setup.fake.setDiscovery({ issuer: "https://other.test" });
    expect(await startOidcSignIn(setup.ctx, { provider: "fake", clientKey: CLIENT })).toEqual({ ok: false, error: "auth.oidc_failed" });
    expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: OpenID Connect sign-in with fake failed: discovery issuer_mismatch");

    setup.fake.setDiscovery({ token_endpoint: "http://fake-oidc.test/token" });
    expect(await startOidcSignIn(setup.ctx, { provider: "fake", clientKey: CLIENT })).toEqual({ ok: false, error: "auth.oidc_failed" });
    expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: OpenID Connect sign-in with fake failed: discovery core.http_unexpected_answer");
    expect(await countRows(setup.test, "oidc_states")).toBe(0);
  });

  it("counts the oidc-start bucket per client address before any work", async () => {
    const fake = createFakeOidcProvider();
    const test = await createTestAuth({ auth: { oidc: { providers: [fake.definition], fetch: fake.fetch } }, buckets: { "oidc-start": { limit: 1, windowMinutes: 15 } } });
    open = test;
    const ctx = { ...test.ctx, env: fake.env };
    expect((await startOidcSignIn(ctx, { provider: "fake", clientKey: CLIENT })).ok).toBe(true);
    expect(await startOidcSignIn(ctx, { provider: "fake", clientKey: CLIENT })).toMatchObject({ ok: false, error: "security.rate_limited" });
    expect(fake.calls.discovery).toBe(1);
  });
});

describe("completeOidcSignIn", () => {
  it("creates the account and its identity on a first sign-in, opens a session and returns to next", async () => {
    const setup = await setUp();
    const onRegistered = vi.fn(() => Promise.resolve());
    const withHook = await setUp({}, { onRegistered });
    const result = await signIn(withHook, ADA, {}, "/reports");
    if (!result.ok) throw new Error(result.error);
    expect(result.value.user).toEqual({ id: expect.any(String) as unknown, email: "ada@example.com", createdAt: NOW, displayName: null });
    expect(result.value.next).toBe("/reports");
    expect(await findSessionUser(withHook.ctx, result.value.session.token)).toEqual(result.value.user);
    const identities = await withHook.test.database.client.query("SELECT provider, subject, user_id, email FROM auth.identities");
    expect(identities.rows).toEqual([{ provider: "fake", subject: "sub-ada", user_id: result.value.user.id, email: "ada@example.com" }]);
    expect(onRegistered).toHaveBeenCalledWith({ user: result.value.user, consent: null, fields: {}, oidcProvider: "fake" }, expect.anything());
    expect(await countRows(withHook.test, "oidc_states")).toBe(0);
    await setup.test.database.close();
  });

  it("signs the same account in by its subject after the email changed at the provider", async () => {
    const setup = await setUp();
    const first = await signIn(setup);
    if (!first.ok) throw new Error(first.error);
    setup.test.clock.advance(60_000);
    const second = await signIn(setup, { subject: "sub-ada", email: "ada.lovelace@example.com" });
    if (!second.ok) throw new Error(second.error);
    expect(second.value.user.id).toBe(first.value.user.id);
    expect(second.value.user.email).toBe("ada@example.com");
    const identity = await setup.test.database.client.query<{ email: string; last_login_at: Date }>("SELECT email, last_login_at FROM auth.identities");
    expect(identity.rows).toEqual([{ email: "ada.lovelace@example.com", last_login_at: new Date(NOW.getTime() + 60_000) }]);
    expect(await countRows(setup.test, "users")).toBe(1);
  });

  it("links an existing password account with the same verified email, which keeps its password", async () => {
    const setup = await setUp();
    const registered = await registerUser(setup.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(registered.error);
    const result = await signIn(setup);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.user.id).toBe(registered.value.user.id);
    expect(await countRows(setup.test, "identities")).toBe(1);
  });

  it("refuses a new subject for an account that already has another identity of the provider", async () => {
    const setup = await setUp();
    expect((await signIn(setup)).ok).toBe(true);
    expect(await signIn(setup, { subject: "sub-recycled", email: "ada@example.com" })).toEqual({ ok: false, error: "auth.oidc_no_account" });
    expect(await countRows(setup.test, "identities")).toBe(1);
  });

  it("only links, never creates, with createAccounts off", async () => {
    const setup = await setUp({ createAccounts: false });
    expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_no_account" });
    expect(await countRows(setup.test, "users")).toBe(0);
    await registerUser(setup.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    expect((await signIn(setup)).ok).toBe(true);
  });

  it("creates one account and one identity for two first sign-ins at once", async () => {
    const setup = await setUp();
    const results = await Promise.all([signIn(setup), signIn(setup)]);
    expect(results.map((result) => result.ok)).toEqual([true, true]);
    expect(await countRows(setup.test, "users")).toBe(1);
    expect(await countRows(setup.test, "identities")).toBe(1);
  });

  describe("the display name", () => {
    async function readDisplayName(setup: Setup): Promise<string | null | undefined> {
      const row = await setup.test.database.client.query<{ display_name: string | null }>("SELECT display_name FROM auth.users");
      return row.rows[0]?.display_name;
    }

    it("stores the name of a first sign-in and returns it on the user and its session", async () => {
      const setup = await setUp();
      const result = await signIn(setup, { ...ADA, name: "Ada Lovelace" });
      if (!result.ok) throw new Error(result.error);
      expect(result.value.user.displayName).toBe("Ada Lovelace");
      expect(await findSessionUser(setup.ctx, result.value.session.token)).toEqual(result.value.user);
      expect(await readDisplayName(setup)).toBe("Ada Lovelace");
    });

    it("hands the stored name to onRegistered for a created account", async () => {
      const onRegistered = vi.fn(() => Promise.resolve());
      const setup = await setUp({}, { onRegistered });
      expect((await signIn(setup, { ...ADA, name: "Ada Lovelace" })).ok).toBe(true);
      expect(onRegistered).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ displayName: "Ada Lovelace" }) as unknown }), expect.anything());
    });

    it("refreshes the name on a later sign-in and keeps it when a sign-in carries none", async () => {
      const setup = await setUp();
      expect((await signIn(setup, { ...ADA, name: "Ada Byron" })).ok).toBe(true);
      const renamed = await signIn(setup, { ...ADA, name: "Ada Lovelace" });
      expect(renamed.ok && renamed.value.user.displayName).toBe("Ada Lovelace");
      const nameless = await signIn(setup, ADA);
      expect(nameless.ok && nameless.value.user.displayName).toBe("Ada Lovelace");
      expect(await readDisplayName(setup)).toBe("Ada Lovelace");
    });

    it("stores the name on a linked password account", async () => {
      const setup = await setUp();
      const registered = await registerUser(setup.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
      if (!registered.ok) throw new Error(registered.error);
      expect(registered.value.user.displayName).toBeNull();
      const result = await signIn(setup, { ...ADA, name: "Ada Lovelace" });
      expect(result.ok && result.value.user).toEqual({ ...registered.value.user, displayName: "Ada Lovelace" });
    });

    it("falls back to given_name, and leaves null without either", async () => {
      const setup = await setUp();
      const given = await signIn(setup, { ...ADA, givenName: "Ada" });
      expect(given.ok && given.value.user.displayName).toBe("Ada");
      const other = await signIn(setup, { subject: "sub-grace", email: "grace@example.com" });
      expect(other.ok && other.value.user.displayName).toBeNull();
    });

    it("normalizes the name and ignores one that is blank or not a string, without refusing the sign-in", async () => {
      const setup = await setUp();
      const spaced = await signIn(setup, { ...ADA, name: "  Ada\u0000 \t Lovelace\n" });
      expect(spaced.ok && spaced.value.user.displayName).toBe("Ada Lovelace");
      const long = await signIn(setup, { ...ADA, name: "é".repeat(250) });
      expect(long.ok && long.value.user.displayName).toBe("é".repeat(200));
      const blank = await signIn(setup, ADA, { claims: { name: "   ", given_name: 42 } });
      expect(blank.ok && blank.value.user.displayName).toBe("é".repeat(200));
    });
  });

  it("creates an account a password login cannot open", async () => {
    const setup = await setUp();
    expect((await signIn(setup)).ok).toBe(true);
    const row = await setup.test.database.client.query<{ password_hash: string }>("SELECT password_hash FROM auth.users");
    expect(row.rows[0]?.password_hash).toMatch(/^scrypt\$/);
  });

  describe("the allowlist", () => {
    it("lets in a listed email of another domain and refuses an unlisted one", async () => {
      const setup = await setUp({ allowedEmails: ["grace@partner.test"] });
      expect((await signIn(setup, { subject: "s1", email: "Grace@Partner.test" })).ok).toBe(true);
      expect(await signIn(setup, { subject: "s2", email: "ada@example.com" })).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
    });

    it("refuses a domain that is not listed, a subdomain, and an unverified or missing email", async () => {
      const setup = await setUp();
      expect(await signIn(setup, { subject: "s1", email: "eve@evil.test" })).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
      expect(await signIn(setup, { subject: "s2", email: "eve@mail.example.com" })).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
      expect(await signIn(setup, { subject: "s3", email: "eve@example.com", emailVerified: false })).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
      expect(await signIn(setup, ADA, { claims: { email: undefined } })).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
      expect(await signIn(setup, ADA, { claims: { email_verified: "true" } })).toMatchObject({ ok: true });
      expect(await countRows(setup.test, "users")).toBe(1);
    });

    it("needs the hd claim to name the domain when the provider requires Workspace accounts", async () => {
      const setup = await setUp({ requireHostedDomain: true });
      expect(await signIn(setup, { subject: "s1", email: "ada@example.com" })).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
      expect(await signIn(setup, { subject: "s2", email: "ada@example.com", hostedDomain: "other.test" })).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
      expect((await signIn(setup, { subject: "s3", email: "ada@example.com", hostedDomain: "example.com" })).ok).toBe(true);
    });
  });

  describe("the ID token", () => {
    const cases: [string, FakeSignInOptions, string][] = [
      ["a wrong nonce", { claims: { nonce: "x".repeat(43) } }, "id_token nonce"],
      ["no nonce", { claims: { nonce: undefined } }, "id_token nonce"],
      ["another audience", { claims: { aud: "other-client" } }, "id_token audience"],
      ["several audiences without azp", { claims: { aud: ["fake-client", "other"] } }, "id_token azp"],
      ["another issuer", { claims: { iss: "https://other.test" } }, "id_token issuer"],
      ["an expired token", { claims: { exp: Math.floor(NOW.getTime() / 1000) - 120 } }, "id_token expired"],
      ["a token issued in the future", { claims: { iat: Math.floor(NOW.getTime() / 1000) + 600 } }, "id_token issued_in_future"],
      ["a key outside the JWKS", { signWith: "unknown-key" }, "jwks unknown_key"],
      ["an unsigned token", { signWith: "none" }, "id_token malformed"],
    ];

    it.each(cases)("refuses %s", async (_name, options, reason) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const setup = await setUp();
      expect(await signIn(setup, ADA, options)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(warn).toHaveBeenCalledWith(`@softure-ai/auth: OpenID Connect sign-in with fake failed: ${reason}`);
      expect(await countRows(setup.test, "users")).toBe(0);
    });

    it("accepts several audiences when azp is the client, and ES256 signatures", async () => {
      expect((await signIn(await setUp(), ADA, { claims: { aud: ["fake-client", "other"], azp: "fake-client" } })).ok).toBe(true);
      await open?.database.close();
      expect((await signIn(await setUp({ algorithm: "ES256" }))).ok).toBe(true);
    });

    it("fetches the new key set once after the provider rotated its keys, and not again within a minute", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const setup = await setUp();
      expect((await signIn(setup)).ok).toBe(true);
      expect(setup.fake.calls.jwks).toBe(1);
      setup.fake.rotateKeys();
      setup.test.clock.advance(61_000);
      expect((await signIn(setup)).ok).toBe(true);
      expect(setup.fake.calls.jwks).toBe(2);
      expect(await signIn(setup, ADA, { signWith: "unknown-key" })).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(setup.fake.calls.jwks).toBe(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(setup.fake.calls.discovery).toBe(1);
    });
  });

  describe("the state and the callback", () => {
    it("refuses a callback without the browser's state, with another browser's, and a replayed one", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const setup = await setUp();
      const started = await startOidcSignIn(setup.ctx, { provider: "fake", clientKey: CLIENT });
      if (!started.ok) throw new Error(started.error);
      const callback = setup.fake.signIn(started.value.url, ADA);
      const params = { state: callback.searchParams.get("state"), code: callback.searchParams.get("code"), error: null };
      const complete = (browserState: string | null) => completeOidcSignIn(setup.ctx, { provider: "fake", params, browserState, clientKey: CLIENT });
      expect(await complete(null)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(await complete("x".repeat(43))).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: OpenID Connect sign-in with fake failed: state not from this browser");
      expect((await complete(started.value.state)).ok).toBe(true);
      expect(await complete(started.value.state)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: OpenID Connect sign-in with fake failed: state unknown, used or expired");
    });

    it("refuses an expired sign-in and a callback on another provider's path", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const setup = await setUp();
      const started = await startOidcSignIn(setup.ctx, { provider: "fake", clientKey: CLIENT });
      if (!started.ok) throw new Error(started.error);
      const callback = setup.fake.signIn(started.value.url, ADA);
      const params = { state: callback.searchParams.get("state"), code: callback.searchParams.get("code"), error: null };
      expect(await completeOidcSignIn(setup.ctx, { provider: "other", params, browserState: started.value.state, clientKey: CLIENT })).toEqual({
        ok: false,
        error: "auth.oidc_failed",
      });
      setup.test.clock.advance(10 * 60_000);
      expect(await completeOidcSignIn(setup.ctx, { provider: "fake", params, browserState: started.value.state, clientKey: CLIENT })).toEqual({
        ok: false,
        error: "auth.oidc_failed",
      });
    });

    it("answers oidc_cancelled when the person refused consent, and oidc_failed when the provider fails", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const setup = await setUp();
      expect(await signIn(setup, ADA, { deny: true })).toEqual({ ok: false, error: "auth.oidc_cancelled" });
      setup.fake.failNext("unavailable", "invalid_grant", "no_id_token");
      expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect((await signIn(setup)).ok).toBe(true);
    });

    it("authenticates the client with HTTP Basic when the provider asks for it", async () => {
      const setup = await setUp({ clientAuth: "basic" });
      expect((await signIn(setup)).ok).toBe(true);
      expect(setup.fake.calls.lastForm?.has("client_secret")).toBe(false);
    });

    it("counts the oidc-callback bucket per client address", async () => {
      const fake = createFakeOidcProvider();
      const test = await createTestAuth({ auth: { oidc: { providers: [fake.definition], fetch: fake.fetch } }, buckets: { "oidc-callback": { limit: 1, windowMinutes: 15 } } });
      open = test;
      const ctx = { ...test.ctx, env: fake.env };
      const params = { state: null, code: null, error: null };
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(await completeOidcSignIn(ctx, { provider: "fake", params, browserState: null, clientKey: CLIENT })).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(await completeOidcSignIn(ctx, { provider: "fake", params, browserState: null, clientKey: CLIENT })).toMatchObject({ ok: false, error: "security.rate_limited" });
    });
  });
});
