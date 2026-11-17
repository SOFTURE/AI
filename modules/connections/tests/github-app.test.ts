// The GitHub App calls against the fake GitHub App: the App's JWT, an installation, a narrowed installation token,
// what the token reaches, the user-side check of an installation and the code exchange, and every failure as a code.
import { createFakeGithubProvider } from "@softure-ai/auth/testing";
import {
  createGithubAppJwt,
  createGithubInstallationToken,
  exchangeGithubUserCode,
  getGithubAppInstallation,
  listGithubInstallationRepositories,
  listGithubUserInstallationRepositories,
} from "@softure-ai/connections/github-app";
import { createFakeGithubApp } from "@softure-ai/connections/testing";
import { createHash, createVerify, generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

const OCTOCAT = { id: 501, login: "octocat", name: "Octo Cat", emails: [{ email: "octocat@example.com" }] };
const REDIRECT_URI = "https://app.example/api/source/callback";

function createApp() {
  const github = createFakeGithubProvider({ openSignUp: true });
  const resolveUserId = async (token: string): Promise<number | null> => {
    const answer = await github.fetch("https://api.github.com/user", { headers: { authorization: `Bearer ${token}` } });
    return answer.ok ? ((await answer.json()) as { id: number }).id : null;
  };
  const app = createFakeGithubApp({ slug: "vault-app", setupUrl: "https://app.example/api/source/setup", resolveUserId });
  const installationId = app.createInstallation({
    account: { login: "octocat" },
    userIds: [OCTOCAT.id],
    repositories: [{ id: 77, fullName: "octocat/notes", defaultBranch: "trunk" }],
  });
  return { app, github, installationId };
}

/** Signs in as `user` with PKCE and answers the code and verifier, as an app's callback would get them. */
function authorizeUser(github: ReturnType<typeof createFakeGithubProvider>, user = OCTOCAT) {
  const verifier = randomBytes(32).toString("base64url");
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", "fake-github-client");
  authorize.searchParams.set("redirect_uri", REDIRECT_URI);
  authorize.searchParams.set("scope", "read:user user:email");
  authorize.searchParams.set("state", "state-1");
  authorize.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
  authorize.searchParams.set("code_challenge_method", "S256");
  const callback = github.signIn(authorize.toString(), user);
  return { code: callback.searchParams.get("code") ?? "", verifier };
}

describe("the GitHub App JWT", () => {
  it("is RS256, issued a minute back, valid nine minutes and signed by the key, from PKCS#1, PKCS#8 or an escaped line", async () => {
    const pkcs1 = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const pkcs8 = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const now = () => new Date("2026-11-17T12:00:00Z");
    for (const [privateKey, publicKey] of [
      [pkcs1.privateKey, pkcs1.publicKey],
      [pkcs8.privateKey, pkcs8.publicKey],
      [pkcs1.privateKey.replaceAll("\n", "\\n"), pkcs1.publicKey],
    ] as const) {
      const jwt = await createGithubAppJwt({ appId: " 12345 ", privateKey }, { now });
      if (!jwt.ok) throw new Error(jwt.error);
      const [header = "", payload = "", signature = ""] = jwt.value.split(".");
      expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
      expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({ iat: 1_794_916_740, exp: 1_794_917_340, iss: "12345" });
      expect(createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    }
  });

  it("refuses a key that is not an RSA private key in PEM, or an empty app id, without quoting the key", async () => {
    for (const credentials of [
      { appId: "1", privateKey: "not a key" },
      { appId: "1", privateKey: "-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----" },
      { appId: "1", privateKey: "-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----" },
      { appId: " ", privateKey: createFakeGithubApp().credentials.privateKey },
    ]) {
      expect(await createGithubAppJwt(credentials)).toEqual({ ok: false, error: "connections.github_app_key_invalid" });
    }
  });
});

describe("the GitHub App calls", () => {
  it("read the installation, mint a narrowed token and list what it reaches", async () => {
    const { app, installationId } = createApp();
    const installation = await getGithubAppInstallation(app.credentials, installationId, { fetch: app.fetch });
    expect(installation).toEqual({
      ok: true,
      value: {
        id: installationId,
        appId: 4242,
        account: { id: expect.any(Number) as number, login: "octocat", type: "User" },
        repositorySelection: "selected",
        permissions: { contents: "read", metadata: "read" },
        isSuspended: false,
      },
    });
    const token = await createGithubInstallationToken(app.credentials, installationId, { fetch: app.fetch, repositoryIds: [77], permissions: { contents: "read" } });
    if (!token.ok) throw new Error(token.error);
    expect(token.value.token).toMatch(/^ghs_/);
    expect(token.value.permissions).toEqual({ contents: "read" });
    expect(token.value.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(await listGithubInstallationRepositories(token.value.token, { fetch: app.fetch })).toEqual({
      ok: true,
      value: {
        totalCount: 1,
        repositories: [{ id: 77, name: "notes", fullName: "octocat/notes", ownerLogin: "octocat", isPrivate: true, defaultBranch: "trunk" }],
      },
    });
  });

  it("work with a key the test hands the fake, escaped as an environment variable would carry it", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const app = createFakeGithubApp({ privateKey: privateKey.replaceAll("\n", "\\n") });
    const installationId = app.createInstallation({ account: { login: "octocat" }, userIds: [OCTOCAT.id], repositories: [{ fullName: "octocat/notes" }] });

    expect(app.credentials.privateKey).toBe(privateKey);
    const installation = await getGithubAppInstallation({ appId: "4242", privateKey }, installationId, { fetch: app.fetch });
    expect(installation.ok).toBe(true);
  });

  it("drop any run of trailing slashes from the API address", async () => {
    const app = createFakeGithubApp();
    const installationId = app.createInstallation({ account: { login: "octocat" }, userIds: [OCTOCAT.id], repositories: [{ fullName: "octocat/notes" }] });
    const urls: string[] = [];
    const fetch: typeof app.fetch = (input, init) => {
      urls.push(String(input));
      return app.fetch(input, init);
    };

    const installation = await getGithubAppInstallation(app.credentials, installationId, { fetch, apiUrl: `https://api.github.com${"/".repeat(50)}` });

    expect(installation.ok).toBe(true);
    expect(urls).toEqual([`https://api.github.com/app/installations/${String(installationId)}`]);
  });

  it("answer not found once the installation is removed, and rejected for a suspended one's token", async () => {
    const { app, installationId } = createApp();
    const token = await createGithubInstallationToken(app.credentials, installationId, { fetch: app.fetch });
    if (!token.ok) throw new Error(token.error);
    app.suspend(installationId);
    const suspended = await getGithubAppInstallation(app.credentials, installationId, { fetch: app.fetch });
    expect(suspended.ok && suspended.value.isSuspended).toBe(true);
    expect(await createGithubInstallationToken(app.credentials, installationId, { fetch: app.fetch })).toEqual({
      ok: false,
      error: "connections.github_app_rejected",
      status: 403,
      retryAfterSeconds: null,
    });
    expect(await listGithubInstallationRepositories(token.value.token, { fetch: app.fetch })).toMatchObject({ ok: false, error: "connections.github_app_rejected" });
    app.uninstall(installationId);
    expect(await getGithubAppInstallation(app.credentials, installationId, { fetch: app.fetch })).toEqual({
      ok: false,
      error: "connections.github_app_not_found",
      status: 404,
      retryAfterSeconds: null,
    });
  });

  it("refuse a JWT signed by another key", async () => {
    const { app, installationId } = createApp();
    const other = createFakeGithubApp();
    const answer = await getGithubAppInstallation({ appId: app.credentials.appId, privateKey: other.credentials.privateKey }, installationId, { fetch: app.fetch });
    expect(answer).toMatchObject({ ok: false, error: "connections.github_app_rejected", status: 401 });
  });

  it("turn a rate limit and an outage into retryable codes", async () => {
    const { app, installationId } = createApp();
    app.failNext("rate_limited", "unavailable");
    expect(await getGithubAppInstallation(app.credentials, installationId, { fetch: app.fetch })).toEqual({
      ok: false,
      error: "connections.github_app_rate_limited",
      status: 429,
      retryAfterSeconds: 30,
    });
    expect(await getGithubAppInstallation(app.credentials, installationId, { fetch: app.fetch })).toMatchObject({
      ok: false,
      error: "connections.github_app_unavailable",
      status: 503,
    });
    const unreachable = await getGithubAppInstallation(app.credentials, installationId, { fetch: () => Promise.reject(new Error("socket hang up token=secret")) });
    expect(unreachable).toEqual({ ok: false, error: "connections.github_app_unavailable", status: null, retryAfterSeconds: null });
  });
});

describe("the user side", () => {
  it("exchanges the code and lists the installation's repositories only for a user who reaches it", async () => {
    const { app, github, installationId } = createApp();
    const { code, verifier } = authorizeUser(github);
    const exchange = { clientId: "fake-github-client", clientSecret: "fake-github-secret", code, redirectUri: REDIRECT_URI, codeVerifier: verifier };
    const userToken = await exchangeGithubUserCode(exchange, { fetch: github.fetch });
    if (!userToken.ok) throw new Error(userToken.error);
    const repositories = await listGithubUserInstallationRepositories(userToken.value, installationId, { fetch: app.fetch });
    expect(repositories.ok && repositories.value.repositories.map((repository) => repository.fullName)).toEqual(["octocat/notes"]);

    expect(await exchangeGithubUserCode(exchange, { fetch: github.fetch })).toEqual({ ok: false, error: "connections.github_app_rejected", status: 200, retryAfterSeconds: null });

    const stranger = authorizeUser(github, { id: 999, login: "stranger", name: "S", emails: [{ email: "stranger@example.com" }] });
    const strangerToken = await exchangeGithubUserCode({ ...exchange, code: stranger.code, codeVerifier: stranger.verifier }, { fetch: github.fetch });
    if (!strangerToken.ok) throw new Error(strangerToken.error);
    expect(await listGithubUserInstallationRepositories(strangerToken.value, installationId, { fetch: app.fetch })).toMatchObject({
      ok: false,
      error: "connections.github_app_not_found",
    });
    expect(await listGithubUserInstallationRepositories("gho_unknown", installationId, { fetch: app.fetch })).toMatchObject({
      ok: false,
      error: "connections.github_app_rejected",
    });
  });

  it("answers the setup URL with the installation and the state of the install URL", () => {
    const { app } = createApp();
    const setup = app.install("https://github.com/apps/vault-app/installations/new?state=abc", {
      account: { login: "octocat" },
      userIds: [OCTOCAT.id],
      repositories: [{ fullName: "octocat/vault" }],
    });
    expect(`${setup.origin}${setup.pathname}`).toBe("https://app.example/api/source/setup");
    expect(setup.searchParams.get("state")).toBe("abc");
    expect(setup.searchParams.get("setup_action")).toBe("install");
    expect(Number(setup.searchParams.get("installation_id"))).toBeGreaterThan(0);
    expect(() => app.install("https://github.com/apps/other/installations/new", { account: { login: "x" }, userIds: [], repositories: [] })).toThrow(/install URL/);
  });
});
