// An in-memory GitHub (an OAuth App) for tests: authorize (`signIn`), the token endpoint and the two API reads the
// sign-in makes (`/user`, `/user/emails`), reached through a `fetch` the app's `auth({ oidc: { fetch } })` takes. It
// checks what GitHub checks (client credentials, redirect URI, PKCE verifier, one-time codes, the bearer token) and
// answers like GitHub: an OAuth error with status 200, a form-encoded body without `Accept: application/json`.
import { createHash, randomBytes } from "node:crypto";
import type { FetchFunction } from "@softure-ai/core";
import type { GithubProviderInput } from "../options.js";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const EMAILS_URL = "https://api.github.com/user/emails";

export interface FakeGithubProviderOptions {
  /** The provider id. Default `github`. */
  readonly id?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  /** The allowlist of the definition. Default `allowedDomains: ["example.com"]`. */
  readonly allowedDomains?: readonly string[];
  readonly allowedEmails?: readonly string[];
  readonly createAccounts?: boolean;
}

/** One of the account's emails, as `/user/emails` lists it. */
export interface FakeGithubEmail {
  readonly email: string;
  /** Default true. */
  readonly verified?: boolean;
  /** Default: true for the first entry only. */
  readonly primary?: boolean;
}

/** The person at GitHub's sign-in screen. */
export interface FakeGithubUser {
  /** The numeric account id: the identity's subject. */
  readonly id: number;
  readonly login: string;
  /** The profile name; null or absent when the profile has none. */
  readonly name?: string | null;
  readonly emails: readonly FakeGithubEmail[];
}

export interface FakeGithubSignInOptions {
  /** The person refuses the authorization: the callback carries `error=access_denied`. */
  readonly deny?: boolean;
}

/** A failure the next calls answer with, in order: the token endpoint for the first two, the API for the others. */
export type FakeGithubFailure = "unavailable" | "bad_verification_code" | "user_unavailable" | "emails_unavailable";

export interface FakeGithubProvider {
  /** The provider entry for `auth({ oidc: { providers: [fake.definition] } })`. */
  readonly definition: GithubProviderInput;
  /** The environment the definition reads its client id and secret from. */
  readonly env: Readonly<Record<string, string>>;
  /** The `fetch` for `auth({ oidc: { fetch } })`. */
  readonly fetch: FetchFunction;
  /** Checks the authorize URL as GitHub does and answers the callback URL it redirects the browser to. */
  signIn(authorizeUrl: string, user: FakeGithubUser, options?: FakeGithubSignInOptions): URL;
  /** The next calls fail like this, one per entry. */
  failNext(...failures: FakeGithubFailure[]): void;
  /** What GitHub saw. */
  readonly calls: {
    readonly token: number;
    readonly user: number;
    readonly emails: number;
    readonly lastForm: URLSearchParams | null;
    /** The access tokens it issued, so a test can check none was stored. */
    readonly issuedTokens: readonly string[];
  };
}

interface PendingCode {
  readonly redirectUri: string;
  readonly challenge: string;
  readonly user: FakeGithubUser;
}

const random = () => randomBytes(24).toString("base64url");

export function createFakeGithubProvider(options: FakeGithubProviderOptions = {}): FakeGithubProvider {
  const id = options.id ?? "github";
  const clientId = options.clientId ?? "fake-github-client";
  const clientSecret = options.clientSecret ?? "fake-github-secret";
  const envPrefix = `${id.toUpperCase().replaceAll("-", "_")}_AUTH`;
  const codes = new Map<string, PendingCode>();
  const tokens = new Map<string, FakeGithubUser>();
  const failures: FakeGithubFailure[] = [];
  const calls = { token: 0, user: 0, emails: 0, lastForm: null as URLSearchParams | null, issuedTokens: [] as string[] };

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
  const takeFailure = (...kinds: FakeGithubFailure[]): FakeGithubFailure | undefined => {
    const next = failures[0];
    if (next === undefined || !kinds.includes(next)) return undefined;
    return failures.shift();
  };

  function answerToken(init: RequestInit): Response {
    calls.token += 1;
    const form = new URLSearchParams(init.body instanceof URLSearchParams ? init.body : typeof init.body === "string" ? init.body : "");
    calls.lastForm = form;
    const headers = new Headers(init.headers);
    const wantsJson = headers.get("accept")?.includes("application/json") === true;
    const answer = (body: Record<string, string>) =>
      wantsJson ? json(200, body) : new Response(new URLSearchParams(body).toString(), { status: 200, headers: { "content-type": "application/x-www-form-urlencoded" } });
    const failure = takeFailure("unavailable", "bad_verification_code");
    if (failure === "unavailable") return json(503, { message: "Service unavailable" });
    if (failure === "bad_verification_code") return answer({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." });
    if (form.get("client_id") !== clientId || form.get("client_secret") !== clientSecret) return answer({ error: "incorrect_client_credentials" });
    const code = form.get("code") ?? "";
    const pending = codes.get(code);
    codes.delete(code);
    if (pending === undefined) return answer({ error: "bad_verification_code" });
    if (form.get("redirect_uri") !== pending.redirectUri) return answer({ error: "redirect_uri_mismatch" });
    const verifier = form.get("code_verifier") ?? "";
    if (createHash("sha256").update(verifier, "ascii").digest("base64url") !== pending.challenge) return answer({ error: "bad_verification_code" });
    const token = `gho_${random()}`;
    tokens.set(token, pending.user);
    calls.issuedTokens.push(token);
    return answer({ access_token: token, token_type: "bearer", scope: "read:user,user:email" });
  }

  function readBearer(init: RequestInit): FakeGithubUser | undefined {
    const authorization = new Headers(init.headers).get("authorization") ?? "";
    return authorization.startsWith("Bearer ") ? tokens.get(authorization.slice(7)) : undefined;
  }

  function answerUser(init: RequestInit): Response {
    calls.user += 1;
    if (takeFailure("user_unavailable") !== undefined) return json(502, { message: "Server Error" });
    const user = readBearer(init);
    if (user === undefined) return json(401, { message: "Bad credentials" });
    return json(200, { login: user.login, id: user.id, type: "User", name: user.name ?? null, email: null });
  }

  function answerEmails(init: RequestInit): Response {
    calls.emails += 1;
    if (takeFailure("emails_unavailable") !== undefined) return json(502, { message: "Server Error" });
    const user = readBearer(init);
    if (user === undefined) return json(401, { message: "Bad credentials" });
    return json(
      200,
      user.emails.map((entry, index) => ({ email: entry.email, primary: entry.primary ?? index === 0, verified: entry.verified ?? true, visibility: null })),
    );
  }

  const fetchFake: FetchFunction = (input, init) => Promise.resolve(route(input, init));

  function route(input: string | URL, init: RequestInit): Response {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const target = `${url.origin}${url.pathname}`;
    const method = init.method ?? "GET";
    if (target === TOKEN_URL && method === "POST") return answerToken(init);
    if (target === USER_URL && method === "GET") return answerUser(init);
    if (target === EMAILS_URL && method === "GET") return answerEmails(init);
    return json(404, { message: "Not Found" });
  }

  return {
    definition: {
      type: "github",
      id,
      name: "GitHub",
      clientIdEnv: `${envPrefix}_CLIENT_ID`,
      clientSecretEnv: `${envPrefix}_CLIENT_SECRET`,
      allowedDomains: [...(options.allowedDomains ?? (options.allowedEmails === undefined ? ["example.com"] : []))],
      allowedEmails: [...(options.allowedEmails ?? [])],
      createAccounts: options.createAccounts,
    },
    env: { [`${envPrefix}_CLIENT_ID`]: clientId, [`${envPrefix}_CLIENT_SECRET`]: clientSecret },
    fetch: fetchFake,
    signIn(authorizeUrl, user, signInOptions = {}) {
      const url = new URL(authorizeUrl);
      const query = url.searchParams;
      if (`${url.origin}${url.pathname}` !== AUTHORIZE_URL) throw new Error(`fake GitHub: authorize URL ${url.origin}${url.pathname} is not ${AUTHORIZE_URL}`);
      if (query.get("client_id") !== clientId) throw new Error("fake GitHub: unknown client_id");
      const scopes = (query.get("scope") ?? "").split(" ");
      if (!scopes.includes("read:user") || !scopes.includes("user:email")) throw new Error("fake GitHub: scope needs read:user and user:email");
      if (query.get("code_challenge_method") !== "S256") throw new Error("fake GitHub: PKCE S256 is required");
      const redirectUri = query.get("redirect_uri");
      const state = query.get("state");
      const challenge = query.get("code_challenge");
      if (redirectUri === null || state === null || challenge === null) throw new Error("fake GitHub: redirect_uri, state and code_challenge are required");
      const callback = new URL(redirectUri);
      callback.searchParams.set("state", state);
      if (signInOptions.deny === true) {
        callback.searchParams.set("error", "access_denied");
        callback.searchParams.set("error_description", "The user has denied your application access.");
        return callback;
      }
      const code = random();
      codes.set(code, { redirectUri, challenge, user });
      callback.searchParams.set("code", code);
      return callback;
    },
    failNext(...next) {
      failures.push(...next);
    },
    calls,
  };
}
