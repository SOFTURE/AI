// GitHub sign-in (an OAuth App) against the fake GitHub: the option entry, the whole flow, the allowlist over the
// account's verified emails and every refusal.
import { auth } from "@softure-ai/auth";
import { completeOidcSignIn, findSessionUser, registerUser, startOidcSignIn } from "@softure-ai/auth/server";
import { createFakeGithubProvider, type FakeGithubProvider, type FakeGithubProviderOptions, type FakeGithubUser } from "@softure-ai/auth/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, countRows, createTestAuth, NOW, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

const ADA: FakeGithubUser = { id: 4242, login: "ada", name: "Ada Lovelace", emails: [{ email: "Ada@Example.com", primary: true }] };

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

async function signIn(setup: Setup, user: FakeGithubUser = ADA, options: { readonly deny?: boolean } = {}, next?: string) {
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

describe("a GitHub provider entry", () => {
  it("fills in its defaults, needs no issuer and keeps an entry without a type an OpenID Connect one", () => {
    const options = auth({
      oidc: {
        providers: [
          { type: "github", clientIdEnv: "GH_AUTH_CLIENT_ID", clientSecretEnv: "GH_AUTH_CLIENT_SECRET", allowedEmails: ["Ada@Example.com"] },
          { id: "corp", name: "Corp", issuer: "https://id.example.com", clientIdEnv: "CORP_ID", allowedDomains: ["example.com"] },
        ],
      },
    }).options;
    expect(options.oidc.providers).toEqual([
      {
        type: "github",
        id: "github",
        name: "GitHub",
        clientIdEnv: "GH_AUTH_CLIENT_ID",
        clientSecretEnv: "GH_AUTH_CLIENT_SECRET",
        scopes: [],
        authorizeParams: {},
        allowedDomains: [],
        allowedEmails: ["ada@example.com"],
        requireHostedDomain: false,
        createAccounts: true,
      },
      expect.objectContaining({ type: "oidc", id: "corp", issuer: "https://id.example.com" }) as unknown,
    ]);
  });

  it("refuses an entry without a client secret, with an issuer, or without an allowlist", () => {
    const base = { type: "github" as const, clientIdEnv: "GH_AUTH_CLIENT_ID", clientSecretEnv: "GH_AUTH_CLIENT_SECRET", allowedEmails: ["ada@example.com"] };
    const withoutSecret = { type: "github" as const, clientIdEnv: "GH_AUTH_CLIENT_ID", allowedEmails: ["ada@example.com"] };
    expect(() => auth({ oidc: { providers: [withoutSecret as typeof base] } })).toThrow(/options\.oidc\.providers\.0\.clientSecretEnv/);
    expect(() => auth({ oidc: { providers: [{ ...base, issuer: "https://github.com" } as typeof base] } })).toThrow(/options\.oidc\.providers\.0: Unrecognized key: "issuer"/);
    expect(() => auth({ oidc: { providers: [{ ...base, allowedEmails: [] }] } })).toThrow(/needs allowedDomains or allowedEmails/);
  });
});

describe("startOidcSignIn with GitHub", () => {
  it("answers GitHub's authorize URL with its scopes, PKCE S256 and a state, and sends no nonce", async () => {
    const setup = await setUp();
    const started = await startOidcSignIn(setup.ctx, { provider: "github", next: "/servers", clientKey: CLIENT });
    if (!started.ok) throw new Error(started.error);
    const url = new URL(started.value.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/login/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "fake-github-client",
      redirect_uri: "http://localhost:3000/api/auth/oidc/github/callback",
      scope: "read:user user:email",
      state: started.value.state,
      code_challenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as unknown,
      code_challenge_method: "S256",
    });
    const rows = await setup.test.database.client.query<{ provider: string; next_path: string }>("SELECT provider, next_path FROM auth.oidc_states");
    expect(rows.rows).toEqual([{ provider: "github", next_path: "/servers" }]);
  });

  it("adds the entry's own scopes and authorize parameters", async () => {
    const fake = createFakeGithubProvider();
    const test = await createTestAuth({ auth: { oidc: { providers: [{ ...fake.definition, scopes: ["read:org"], authorizeParams: { allow_signup: "false" } }], fetch: fake.fetch } } });
    open = test;
    const started = await startOidcSignIn({ ...test.ctx, env: fake.env }, { provider: "github", clientKey: CLIENT });
    if (!started.ok) throw new Error(started.error);
    const query = new URL(started.value.url).searchParams;
    expect([query.get("scope"), query.get("allow_signup")]).toEqual(["read:user user:email read:org", "false"]);
  });

  it("refuses to start without the client secret and names only the variable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const setup = await setUp();
    const env = { GITHUB_AUTH_CLIENT_ID: "fake-github-client" };
    expect(await startOidcSignIn({ ...setup.ctx, env }, { provider: "github", clientKey: CLIENT })).toEqual({ ok: false, error: "auth.oidc_failed" });
    expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: OpenID Connect sign-in with github failed: GITHUB_AUTH_CLIENT_SECRET is not set");
    expect(await countRows(setup.test.database, "oidc_states")).toBe(0);
  });
});

describe("completeOidcSignIn with GitHub", () => {
  it("creates the account and its identity by GitHub's numeric id, opens a session and returns to next", async () => {
    const onRegistered = vi.fn(() => Promise.resolve());
    const setup = await setUp({}, { onRegistered });
    const result = await signIn(setup, ADA, {}, "/servers");
    if (!result.ok) throw new Error(result.error);
    expect(result.value.user).toEqual({ id: expect.any(String) as unknown, email: "ada@example.com", createdAt: NOW, displayName: "Ada Lovelace" });
    expect(result.value.next).toBe("/servers");
    expect(await findSessionUser(setup.ctx, result.value.session.token)).toEqual(result.value.user);
    const identities = await setup.test.database.client.query("SELECT provider, subject, user_id, email FROM auth.identities");
    expect(identities.rows).toEqual([{ provider: "github", subject: "4242", user_id: result.value.user.id, email: "ada@example.com" }]);
    expect(onRegistered).toHaveBeenCalledWith({ user: result.value.user, consent: null, fields: {}, oidcProvider: "github" }, expect.anything());
    expect(setup.fake.calls).toMatchObject({ token: 1, user: 1, emails: 1 });
    expect(setup.fake.calls.lastForm?.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await countRows(setup.test.database, "oidc_states")).toBe(0);
  });

  it("keeps the account after a login rename and an email change at GitHub, and falls back to the login as the name", async () => {
    const setup = await setUp();
    const first = await signIn(setup);
    if (!first.ok) throw new Error(first.error);
    const renamed: FakeGithubUser = { id: 4242, login: "countess", name: null, emails: [{ email: "lovelace@example.com", primary: true }] };
    const second = await signIn(setup, renamed);
    if (!second.ok) throw new Error(second.error);
    expect(second.value.user).toEqual({ ...first.value.user, displayName: "countess" });
  });

  it("links an existing password account with the same verified email", async () => {
    const setup = await setUp();
    const registered = await registerUser(setup.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(registered.error);
    const result = await signIn(setup);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.user.id).toBe(registered.value.user.id);
  });

  describe("the allowlist over the account's emails", () => {
    it("signs in with a verified non-primary email the allowlist names when the primary is not allowed", async () => {
      const setup = await setUp({ allowedEmails: ["ada@work.test"] });
      const user: FakeGithubUser = { ...ADA, emails: [{ email: "ada@home.test", primary: true }, { email: "ada@work.test" }] };
      const result = await signIn(setup, user);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.user.email).toBe("ada@work.test");
    });

    it("prefers the primary email when several are allowed", async () => {
      const setup = await setUp();
      const user: FakeGithubUser = { ...ADA, emails: [{ email: "second@example.com" }, { email: "first@example.com", primary: true }] };
      const result = await signIn(setup, user);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.user.email).toBe("first@example.com");
    });

    it("refuses an unverified email, an unlisted domain and an account without emails, and creates nothing", async () => {
      const setup = await setUp();
      const refusals: FakeGithubUser[] = [
        { ...ADA, emails: [{ email: "ada@example.com", primary: true, verified: false }] },
        { ...ADA, emails: [{ email: "ada@other.test", primary: true }] },
        { ...ADA, emails: [{ email: "ada@sub.example.com", primary: true }] },
        { ...ADA, emails: [] },
      ];
      for (const user of refusals) {
        expect(await signIn(setup, user)).toEqual({ ok: false, error: "auth.oidc_not_allowed" });
      }
      expect(await countRows(setup.test.database, "users")).toBe(0);
      expect(await countRows(setup.test.database, "identities")).toBe(0);
    });
  });

  it("answers oidc_cancelled when the person refused consent", async () => {
    const setup = await setUp();
    expect(await signIn(setup, ADA, { deny: true })).toEqual({ ok: false, error: "auth.oidc_cancelled" });
    expect(setup.fake.calls.token).toBe(0);
  });

  it("answers oidc_failed and logs only the reason when GitHub refuses the code with status 200, or is down", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const setup = await setUp();
    setup.fake.failNext("bad_verification_code");
    expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
    expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: OpenID Connect sign-in with github failed: token bad_verification_code");
    setup.fake.failNext("token_unavailable");
    expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
    expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: OpenID Connect sign-in with github failed: token core.http_unavailable");
    setup.fake.failNext("api_unavailable");
    expect(await signIn(setup)).toEqual({ ok: false, error: "auth.oidc_failed" });
    expect(warn).toHaveBeenLastCalledWith("@softure-ai/auth: OpenID Connect sign-in with github failed: user core.http_unavailable");
    expect(await countRows(setup.test.database, "users")).toBe(0);
  });

  it("answers oidc_failed for a wrong client secret, and never logs the secret or a token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const setup = await setUp();
    const ctx = { ...setup.ctx, env: { ...setup.fake.env, GITHUB_AUTH_CLIENT_SECRET: "wrong-secret" } };
    const started = await startOidcSignIn(ctx, { provider: "github", clientKey: CLIENT });
    if (!started.ok) throw new Error(started.error);
    const callback = setup.fake.signIn(started.value.url, ADA);
    const code = callback.searchParams.get("code");
    const result = await completeOidcSignIn(ctx, { provider: "github", params: { state: callback.searchParams.get("state"), code, error: null }, browserState: started.value.state, clientKey: CLIENT });
    expect(result).toEqual({ ok: false, error: "auth.oidc_failed" });
    const logged = warn.mock.calls.flat().join("\n");
    expect(logged).toContain("token incorrect_client_credentials");
    expect(logged).not.toContain("wrong-secret");
    expect(logged).not.toContain(code ?? "missing-code");
    expect(logged).not.toContain("gho_");
  });

  it("refuses a replayed callback", async () => {
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
  });
});
