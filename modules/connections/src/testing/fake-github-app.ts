// An in-memory GitHub App for tests: installations the test creates (or a person "installs" through `install`, which
// answers the App's setup URL as GitHub redirects to it), the App's JWT checked against its own key pair, installation
// access tokens, the repositories an installation token reaches, and the repositories of one installation a user's
// token reaches. A user token belongs to whatever fake handles the user's sign-in (auth's fake GitHub, say): the fake
// asks `resolveUserId` who holds it. Reached through a `fetch` the app passes to the `github-app` calls.
import { createVerify, generateKeyPairSync, randomBytes } from "node:crypto";
import type { FetchFunction } from "@softure-ai/core";
import type { GithubAppCredentials } from "../github-app/jwt.js";

const API_ORIGIN = "https://api.github.com";
const INSTALL_PATH = /^\/apps\/([^/]+)\/installations\/new$/;

export interface FakeGithubAppOptions {
  readonly appId?: number;
  /** The App's URL name (`https://github.com/apps/<slug>`). Default `fake-app`. */
  readonly slug?: string;
  /** Where GitHub sends the browser after an installation (the App's "Setup URL"). */
  readonly setupUrl?: string;
  /** Who holds a user access token; null for a token nobody holds. Without it every user token is refused. */
  readonly resolveUserId?: (token: string) => Promise<number | null> | number | null;
  /** The App's permissions. Default `{ contents: "read", metadata: "read" }`. */
  readonly permissions?: Readonly<Record<string, string>>;
}

export interface FakeGithubRepositoryInput {
  readonly id?: number;
  /** `owner/name`. */
  readonly fullName: string;
  readonly defaultBranch?: string;
  readonly isPrivate?: boolean;
}

export interface FakeGithubInstallationInput {
  readonly account: { readonly login: string; readonly id?: number; readonly type?: "User" | "Organization" };
  /** The GitHub users who can reach the installation (the account's owner and members). */
  readonly userIds: readonly number[];
  readonly repositories: readonly FakeGithubRepositoryInput[];
  /** Default `selected`. */
  readonly repositorySelection?: "all" | "selected";
}

/** A failure the next API call answers with, one per entry. */
export type FakeGithubAppFailure = "unavailable" | "rate_limited";

export interface FakeGithubApp {
  /** The App's id and private key (PKCS#1 PEM, as GitHub hands it out). */
  readonly credentials: GithubAppCredentials;
  readonly slug: string;
  readonly fetch: FetchFunction;
  /** Creates an installation and answers its id. */
  createInstallation(input: FakeGithubInstallationInput): number;
  /**
   * A person installs the App from its install URL (`https://github.com/apps/<slug>/installations/new?state=…`):
   * creates the installation and answers the setup URL GitHub redirects to, with `installation_id`, `setup_action`
   * and the `state` of the install URL.
   */
  install(installUrl: string, input: FakeGithubInstallationInput): URL;
  /** The account removes the installation: every call about it answers 404 and its tokens die. */
  uninstall(installationId: number): void;
  suspend(installationId: number): void;
  /** The account changes which repositories the installation reaches. */
  setRepositories(installationId: number, repositories: readonly FakeGithubRepositoryInput[]): void;
  failNext(...failures: FakeGithubAppFailure[]): void;
  readonly calls: { readonly installation: number; readonly accessTokens: number; readonly repositories: number; readonly userRepositories: number };
}

interface FakeInstallation {
  readonly id: number;
  readonly account: { readonly login: string; readonly id: number; readonly type: string };
  readonly userIds: ReadonlySet<number>;
  repositories: FakeRepository[];
  readonly repositorySelection: "all" | "selected";
  isSuspended: boolean;
}

interface FakeRepository {
  readonly id: number;
  readonly fullName: string;
  readonly defaultBranch: string;
  readonly isPrivate: boolean;
}

interface IssuedToken {
  readonly installationId: number;
  readonly repositoryIds: ReadonlySet<number> | null;
  readonly expiresAt: number;
}

let nextId = 100_000;

export function createFakeGithubApp(options: FakeGithubAppOptions = {}): FakeGithubApp {
  const appId = options.appId ?? 4242;
  const slug = options.slug ?? "fake-app";
  const permissions = { ...(options.permissions ?? { contents: "read", metadata: "read" }) };
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const installations = new Map<number, FakeInstallation>();
  const tokens = new Map<string, IssuedToken>();
  const failures: FakeGithubAppFailure[] = [];
  const calls = { installation: 0, accessTokens: 0, repositories: 0, userRepositories: 0 };

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
  const notFound = () => json(404, { message: "Not Found" });

  function toRepository(input: FakeGithubRepositoryInput): FakeRepository {
    return { id: input.id ?? (nextId += 1), fullName: input.fullName, defaultBranch: input.defaultBranch ?? "main", isPrivate: input.isPrivate ?? true };
  }

  function createInstallation(input: FakeGithubInstallationInput): number {
    nextId += 1;
    const id = nextId;
    installations.set(id, {
      id,
      account: { login: input.account.login, id: input.account.id ?? (nextId += 1), type: input.account.type ?? "User" },
      userIds: new Set(input.userIds),
      repositories: input.repositories.map(toRepository),
      repositorySelection: input.repositorySelection ?? "selected",
      isSuspended: false,
    });
    return id;
  }

  function readBearer(init: RequestInit): string | null {
    const authorization = new Headers(init.headers).get("authorization") ?? "";
    return authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
  }

  /** Whether the bearer is a JWT this App signed, issued in the past and not yet expired. */
  function isAppJwt(init: RequestInit): boolean {
    const jwt = readBearer(init);
    const parts = jwt?.split(".") ?? [];
    if (parts.length !== 3) return false;
    const [header, payload, signature] = parts as [string, string, string];
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    if (!verifier.verify(publicKey, Buffer.from(signature, "base64url"))) return false;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { iat?: number; exp?: number; iss?: string };
    const now = Math.floor(Date.now() / 1000);
    return claims.iss === String(appId) && typeof claims.iat === "number" && typeof claims.exp === "number" && claims.iat <= now && claims.exp > now && claims.exp - claims.iat <= 600;
  }

  function repositoryJson(repository: FakeRepository) {
    const [owner = "", name = ""] = repository.fullName.split("/");
    return { id: repository.id, name, full_name: repository.fullName, owner: { login: owner }, private: repository.isPrivate, default_branch: repository.defaultBranch };
  }

  function installationJson(installation: FakeInstallation) {
    return {
      id: installation.id,
      app_id: appId,
      account: installation.account,
      repository_selection: installation.repositorySelection,
      permissions,
      suspended_at: installation.isSuspended ? new Date().toISOString() : null,
    };
  }

  async function readBody(init: RequestInit): Promise<Record<string, unknown>> {
    if (init.body === undefined || init.body === null) return {};
    const text = typeof init.body === "string" ? init.body : await new Response(init.body).text();
    return text === "" ? {} : (JSON.parse(text) as Record<string, unknown>);
  }

  async function answerAccessToken(installation: FakeInstallation, init: RequestInit): Promise<Response> {
    calls.accessTokens += 1;
    if (installation.isSuspended) return json(403, { message: "This installation has been suspended" });
    const body = await readBody(init);
    const requested = Array.isArray(body.repository_ids) ? body.repository_ids.filter((id): id is number => typeof id === "number") : null;
    if (requested !== null && requested.some((id) => !installation.repositories.some((repository) => repository.id === id))) {
      return json(422, { message: "There is at least one repository that does not exist or is not accessible to the parent installation." });
    }
    const token = `ghs_${randomBytes(18).toString("base64url")}`;
    const expiresAt = Date.now() + 3_600_000;
    tokens.set(token, { installationId: installation.id, repositoryIds: requested === null ? null : new Set(requested), expiresAt });
    return json(201, { token, expires_at: new Date(expiresAt).toISOString(), permissions: body.permissions ?? permissions });
  }

  function answerInstallationRepositories(init: RequestInit): Response {
    calls.repositories += 1;
    const issued = tokens.get(readBearer(init) ?? "");
    const installation = issued === undefined ? undefined : installations.get(issued.installationId);
    if (issued === undefined || issued.expiresAt <= Date.now() || installation === undefined) return json(401, { message: "Bad credentials" });
    const reachable = installation.repositories.filter((repository) => issued.repositoryIds === null || issued.repositoryIds.has(repository.id));
    return json(200, { total_count: reachable.length, repositories: reachable.map(repositoryJson) });
  }

  async function answerUserRepositories(installationId: number, init: RequestInit): Promise<Response> {
    calls.userRepositories += 1;
    const token = readBearer(init);
    const userId = token === null || options.resolveUserId === undefined ? null : await options.resolveUserId(token);
    if (userId === null) return json(401, { message: "Bad credentials" });
    const installation = installations.get(installationId);
    if (installation === undefined || !installation.userIds.has(userId)) return notFound();
    return json(200, { total_count: installation.repositories.length, repositories: installation.repositories.map(repositoryJson) });
  }

  async function route(input: string | URL, init: RequestInit): Promise<Response> {
    const url = new URL(typeof input === "string" ? input : input.toString());
    if (url.origin !== API_ORIGIN) return notFound();
    const failure = failures.shift();
    if (failure === "unavailable") return json(503, { message: "Service unavailable" });
    if (failure === "rate_limited") return json(429, { message: "API rate limit exceeded" }, { "retry-after": "30" });
    const method = init.method ?? "GET";
    const path = url.pathname;
    const appMatch = /^\/app\/installations\/(\d+)(\/access_tokens)?$/.exec(path);
    if (appMatch !== null) {
      if (!isAppJwt(init)) return json(401, { message: "A JSON web token could not be decoded" });
      const installation = installations.get(Number(appMatch[1]));
      if (installation === undefined) return notFound();
      if (appMatch[2] === undefined && method === "GET") {
        calls.installation += 1;
        return json(200, installationJson(installation));
      }
      if (appMatch[2] !== undefined && method === "POST") return answerAccessToken(installation, init);
      return notFound();
    }
    if (path === "/installation/repositories" && method === "GET") return answerInstallationRepositories(init);
    const userMatch = /^\/user\/installations\/(\d+)\/repositories$/.exec(path);
    if (userMatch !== null && method === "GET") return answerUserRepositories(Number(userMatch[1]), init);
    return notFound();
  }

  function forget(installationId: number): void {
    for (const [token, issued] of tokens) if (issued.installationId === installationId) tokens.delete(token);
  }

  return {
    credentials: { appId: String(appId), privateKey },
    slug,
    fetch: (input, init) => route(input, init),
    createInstallation,
    install(installUrl, input) {
      const url = new URL(installUrl);
      const match = INSTALL_PATH.exec(url.pathname);
      if (url.origin !== "https://github.com" || match === null || match[1] !== slug) throw new Error(`fake GitHub App: ${url.origin}${url.pathname} is not the install URL of ${slug}`);
      if (options.setupUrl === undefined) throw new Error("fake GitHub App: install needs setupUrl");
      const id = createInstallation(input);
      const setup = new URL(options.setupUrl);
      setup.searchParams.set("installation_id", String(id));
      setup.searchParams.set("setup_action", "install");
      const state = url.searchParams.get("state");
      if (state !== null) setup.searchParams.set("state", state);
      return setup;
    },
    uninstall(installationId) {
      installations.delete(installationId);
      forget(installationId);
    },
    suspend(installationId) {
      const installation = installations.get(installationId);
      if (installation !== undefined) installation.isSuspended = true;
      forget(installationId);
    },
    setRepositories(installationId, repositories) {
      const installation = installations.get(installationId);
      if (installation !== undefined) installation.repositories = repositories.map(toRepository);
    },
    failNext(...next) {
      failures.push(...next);
    },
    calls,
  };
}
