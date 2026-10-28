// Sign-in with GitHub (an OAuth App) against the fake GitHub: the flow it shares with OpenID Connect, the token
// exchange with GitHub's 200-status errors, the account read from the API and the allowlist over verified emails.
import { auth } from "@softure-ai/auth";
import { completeOidcSignIn, findSessionUser, loginUser, registerUser, startOidcSignIn } from "@softure-ai/auth/server";
import {
  createFakeGithubProvider,
  type FakeGithubProvider,
  type FakeGithubProviderOptions,
  type FakeGithubSignInOptions,
  type FakeGithubUser,
} from "@softure-ai/auth/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, countRows, createTestAuth, NOW, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

const ADA: FakeGithubUser = { id: 583231, login: "ada-l", name: "Ada Lovelace", emails: [{ email: "Ada@Example.com" }] };

interface Setup {
  readonly test: TestAuth;
  readonly fake: FakeGithubProvider;
  readonly ctx: TestAuth["ctx"] & { readonly env: Readonly<Record<string, string>> };
}

let open: TestAuth | undefined;

async function setUp(fakeOptions: FakeGithubProviderOptions = {}, config: ConfigOptions["auth"] = {}): Promise<Setup> {
  const fake = createFakeGithubProvider(fakeOptions);
  const test = await createTestAuth({ auth: { ...config, oidc: { providers: [fake.definition], fetch: fake.fetch } } });
  open = test;
  return { test, fake, ctx: { ...test.ctx, env: fake.env } };
}

afterEach(async () => {
  await open?.database.close();
  open = undefined;
  vi.restoreAllMocks();
});

async function signIn(setup: Setup, user: FakeGithubUser = ADA, options: FakeGithubSignInOptions = {}, next?: string) {
  const started = await startOidcSignIn(setup.ctx, { provider: "github", next, clientKey: CLIENT });
  if (!started.ok) throw new Error(started.error);
  const callback = setup.fake.signIn(started.value.url, user, options);
  return completeOidcSignIn(setup.ctx, {
    provider: "github",
    params: { state: callback.searchParams.get("state"), code: callback.searchParams.get("code"), error: callback.searchParams.get("error") },
    browserState: started.value.state,
    clientKey: CLIENT,
  });
}

describe("the GitHub provider's options", () => {
  const github = { type: "github", id: "github", name: "GitHub", clientIdEnv: "GITHUB_AUTH_CLIENT_ID", clientSecretEnv: "GITHUB_AUTH_CLIENT_SECRET" } as const;

  it("fills in the defaults, with no issuer and no hosted domain", () => {
    const options = auth({ password: { enabled: false }, oidc: { providers: [{ ...github, allowedEmails: [" Owner@Example.com"] }] } }).options;
    expect(options.oidc.providers).toEqual([
      { ...github, authorizeParams: {}, allowedDomains: [], allowedEmails: ["owner@example.com"], createAccounts: true, requireHostedDomain: false },
    ]);
  });

  it("refuses a GitHub provider without an allowlist or a client secret, and OpenID Connect fields on it", () => {
    expect(() => auth({ oidc: { providers: [github] } })).toThrow(
      "- options.oidc.providers.0.allowedDomains: needs allowedDomains or allowedEmails: a sign-in through a provider is limited to them",
    );
    const withoutSecret = { type: "github", id: "github", name: "GitHub", clientIdEnv: "GITHUB_AUTH_CLIENT_ID", allowedDomains: ["example.com"] } as const;
    // @ts-expect-error -- the secret is required for GitHub
    expect(() => auth({ oidc: { providers: [withoutSecret] } })).toThrow("options.oidc.providers.0.clientSecretEnv");
    // @ts-expect-error -- GitHub has no issuer
    expect(() => auth({ oidc: { providers: [{ ...github, issuer: "https://github.com", allowedDomains: ["example.com"] }] } })).toThrow("issuer");
    // @ts-expect-error -- an unknown provider type
    expect(() => auth({ oidc: { providers: [{ ...github, type: "gitlab", allowedDomains: ["example.com"] }] } })).toThrow("options.oidc.providers.0.type");
  });
});

describe("startOidcSignIn with GitHub", () => {
  it("answers GitHub's authorize URL with PKCE S256, a state, the account scopes and no nonce, without any network call", async () => {
    const setup = await setUp();
    const fetchSpy = vi.fn(setup.fake.fetch);
    const test = await createTestAuth({ auth: { oidc: { providers: [{ ...setup.fake.definition, authorizeParams: { allow_signup: "false" } }], fetch: fetchSpy } } });
    const started = await startOidcSignIn({ ...test.ctx, env: setup.fake.env }, { provider: "github", next: "/reports", clientKey: CLIENT });
    await test.database.close();
    if (!started.ok) throw new Error(started.error);
    const url = new URL(started.value.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/login/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      allow_signup: "false",
      response_type: "code",
      client_id: "fake-github-client",
      redirect_uri: "http://localhost:3000/api/auth/oidc/github/callback",
      scope: "read:user user:email",
      state: started.value.state,
      code_challenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as unknown,
      code_challenge_method: "S256",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses without the client secret in the environment and names the variable in the log", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const setup = await setUp();
    const env = { GITHUB_AUTH_CLIENT_ID: "fake-github-client" };
    expect(await startOidcSignIn({ ...setup.ctx, env }, { provider: "github", clientKey: CLIENT })).toEqual({ ok: false, error: "auth.oidc_failed" });
    expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: GitHub sign-in with github failed: GITHUB_AUTH_CLIENT_SECRET is not set");
    expect(await countRows(setup.test.database, "oidc_states")).toBe(0);
  });
});

describe("completeOidcSignIn with GitHub", () => {
  it("creates the account and its identity keyed by the numeric id, opens a session and returns to next", async () => {
    const onRegistered = vi.fn(() => Promise.resolve());
    const setup = await setUp({}, { onRegistered });
    const result = await signIn(setup, ADA, {}, "/reports");
    if (!result.ok) throw new Error(result.error);
    expect(result.value.user).toEqual({ id: expect.any(String) as unknown, email: "ada@example.com", createdAt: NOW, displayName: "Ada Lovelace" });
    expect(result.value.next).toBe("/reports");
    expect(await findSessionUser(setup.ctx, result.value.session.token)).toEqual(result.value.user);
    const identities = await setup.test.database.client.query("SELECT provider, subject, user_id, email FROM auth.identities");
    expect(identities.rows).toEqual([{ provider: "github", subject: "583231", user_id: result.value.user.id, email: "ada@example.com" }]);
    expect(onRegistered).toHaveBeenCalledWith({ user: result.value.user, consent: null, fields: {}, oidcProvider: "github" }, expect.anything());
    expect(await countRows(setup.test.database, "oidc_states")).toBe(0);
    expect(setup.fake.calls).toMatchObject({ token: 1, user: 1, emails: 1 });
    expect(setup.fake.calls.lastForm?.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("keeps no access token: neither in the database nor in the result", async () => {
    const setup = await setUp();
    const result = await signIn(setup);
    const [token] = setup.fake.calls.issuedTokens;
    expect(token).toMatch(/^gho_/);
    const dump = await setup.test.database.client.query<{ dump: string }>(
      "SELECT (SELECT coalesce(json_agg(i), '[]') FROM auth.identities i)::text || (SELECT coalesce(json_agg(u), '[]') FROM auth.users u)::text || (SELECT coalesce(json_agg(s), '[]') FROM auth.sessions s)::text AS dump",
    );
    expect(dump.rows[0]?.dump).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("signs the same account in after the login and the email changed, and falls back to the login as the name", async () => {
    const setup = await setUp();
    const first = await signIn(setup);
    if (!first.ok) throw new Error(first.error);
    const renamed: FakeGithubUser = { id: ADA.id, login: "ada-renamed", name: null, emails: [{ email: "lovelace@example.com" }] };
    const second = await signIn(setup, renamed);
    if (!second.ok) throw new Error(second.error);
    expect(second.value.user).toEqual({ ...first.value.user, displayName: "ada-renamed" });
    const identities = await setup.test.database.client.query("SELECT subject, email FROM auth.identities");
    expect(identities.rows).toEqual([{ subject: "583231", email: "lovelace@example.com" }]);
  });

  it("links an existing password account with the same verified email, which keeps its password", async () => {
    const setup = await setUp();
    const registered = await registerUser(setup.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(registered.error);
    const result = await signIn(setup);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.user.id).toBe(registered.value.user.id);
    expect((await loginUser(setup.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT })).ok).toBe(true);
  });

  it("only links, never creates, with createAccounts off", async () => {
    const setup = await setUp({ createAccounts: false });
    expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_no_account" });
    expect(await countRows(setup.test.database, "users")).toBe(0);
  });

  describe("the allowlist over GitHub's emails", () => {
    it("takes the primary email when it is allowed", async () => {
      const setup = await setUp({ allowedDomains: ["example.com", "corp.test"] });
      const user: FakeGithubUser = { ...ADA, emails: [{ email: "ada@corp.test", primary: false }, { email: "ada@example.com", primary: true }] };
      expect(await signIn(setup, user)).toMatchObject({ ok: true, value: { user: { email: "ada@example.com" } } });
    });

    it("takes another verified email the allowlist names when the primary one is not allowed", async () => {
      const setup = await setUp({ allowedEmails: ["owner@corp.test"] });
      const user: FakeGithubUser = { ...ADA, emails: [{ email: "ada@personal.test" }, { email: "Owner@Corp.test" }] };
      expect(await signIn(setup, user)).toMatchObject({ ok: true, value: { user: { email: "owner@corp.test" } } });
    });

    it("ignores unverified emails and refuses when no verified email is allowed", async () => {
      const setup = await setUp();
      expect(await signIn(setup, { ...ADA, emails: [{ email: "ada@example.com", verified: false }] })).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
      expect(await signIn(setup, { ...ADA, emails: [{ email: "ada@other.test" }, { email: "ada@sub.example.com" }] })).toEqual({
        ok: false,
        error: "auth.oidc_not_allowed",
      });
      expect(await signIn(setup, { ...ADA, emails: [] })).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
      expect(await countRows(setup.test.database, "users")).toBe(0);
    });
  });

  describe("GitHub's answers", () => {
    it("answers oidc_cancelled when the person refused, without calling GitHub", async () => {
      const setup = await setUp();
      expect(await signIn(setup, ADA, { deny: true })).toEqual({ ok: false, error: "auth.oidc_cancelled" });
      expect(setup.fake.calls.token).toBe(0);
    });

    it("reads an OAuth error that GitHub answers with status 200, and logs only its code", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const setup = await setUp();
      setup.fake.failNext("bad_verification_code");
      expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: GitHub sign-in with github failed: token bad_verification_code");
      expect(setup.fake.calls.user).toBe(0);
    });

    it("refuses on wrong client credentials and on an outage of the token endpoint or the API", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const setup = await setUp();
      const wrongSecret = { ...setup.ctx, env: { ...setup.fake.env, GITHUB_AUTH_CLIENT_SECRET: "wrong" } };
      const started = await startOidcSignIn(wrongSecret, { provider: "github", clientKey: CLIENT });
      if (!started.ok) throw new Error(started.error);
      const callback = setup.fake.signIn(started.value.url, ADA);
      const params = { state: callback.searchParams.get("state"), code: callback.searchParams.get("code"), error: null };
      expect(await completeOidcSignIn(wrongSecret, { provider: "github", params, browserState: started.value.state, clientKey: CLIENT })).toEqual({
        ok: false,
        error: "auth.oidc_failed",
      });
      expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: GitHub sign-in with github failed: token incorrect_client_credentials");

      setup.fake.failNext("unavailable");
      expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
      setup.fake.failNext("user_unavailable");
      expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(warn.mock.lastCall?.[0]).toMatch(/failed: user core\.http_/);
      setup.fake.failNext("emails_unavailable");
      expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(warn.mock.lastCall?.[0]).toMatch(/failed: emails core\.http_/);
      expect(await countRows(setup.test.database, "users")).toBe(0);
      expect((await signIn(setup)).ok).toBe(true);
    });

    it("refuses a replayed callback: the state and the code are one-time", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const setup = await setUp();
      const started = await startOidcSignIn(setup.ctx, { provider: "github", clientKey: CLIENT });
      if (!started.ok) throw new Error(started.error);
      const callback = setup.fake.signIn(started.value.url, ADA);
      const input = {
        provider: "github",
        params: { state: callback.searchParams.get("state"), code: callback.searchParams.get("code"), error: null },
        browserState: started.value.state,
        clientKey: CLIENT,
      };
      expect((await completeOidcSignIn(setup.ctx, input)).ok).toBe(true);
      expect(await completeOidcSignIn(setup.ctx, input)).toEqual({ ok: false, error: "auth.oidc_failed" });
      expect(await completeOidcSignIn(setup.ctx, { ...input, browserState: null })).toEqual({ ok: false, error: "auth.oidc_failed" });
    });
  });
});
