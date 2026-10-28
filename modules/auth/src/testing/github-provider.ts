// An in-memory GitHub OAuth App for tests: authorize (`signIn`), the token endpoint, `/user` and `/user/emails`,
// reached through a `fetch` the app's `auth({ oidc: { fetch } })` takes. It checks what GitHub checks (client
// credentials, redirect URI, PKCE verifier, one-time codes, the access token on API calls) and answers errors the way
// GitHub does (an OAuth error with status 200). A test breaks it on purpose: an outage, a bad code, an API failure.
import { createHash, randomBytes } from "node:crypto";
import type { FetchFunction } from "@softure-ai/core";
import type { OidcProviderInput } from "../options.js";

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
  /** Default false. */
  readonly primary?: boolean;
  /** Default true. */
  readonly verified?: boolean;
}

/** The person at GitHub's sign-in screen. */
export interface FakeGithubUser {
  /** GitHub's numeric user id. */
  readonly id: number;
  readonly login: string;
  /** The profile name; null or absent when the account has none. */
  readonly name?: string | null;
  readonly emails: readonly FakeGithubEmail[];
}

export interface FakeGithubSignInOptions {
  /** The person refuses consent: the callback carries `error=access_denied`. */
  readonly deny?: boolean;
}

/**
 * A failure the next call answers with, in order: the token endpoint unavailable (503) or answering
 * `bad_verification_code` with status 200, or the API's `/user` unavailable.
 */
export type FakeGithubFailure = "token_unavailable" | "bad_verification_code" | "api_unavailable";

export interface FakeGithubProvider {
  /** The provider entry for `auth({ oidc: { providers: [fake.definition] } })`. */
  readonly definition: OidcProviderInput;
  /** The environment the definition reads its client id and secret from. */
  readonly env: Readonly<Record<string, string>>;
  /** The `fetch` for `auth({ oidc: { fetch } })`. */
  readonly fetch: FetchFunction;
  /** Checks the authorize URL as GitHub does and answers the callback URL it redirects the browser to. */
  signIn(authorizeUrl: string, user: FakeGithubUser, options?: FakeGithubSignInOptions): URL;
  /** The next calls fail like this, one per entry. */
  failNext(...failures: FakeGithubFailure[]): void;
  /** What GitHub saw. */
  readonly calls: { readonly token: number; readonly user: number; readonly emails: number; readonly lastForm: URLSearchParams | null };
}

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const EMAILS_URL = "https://api.github.com/user/emails";

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
  const calls = { token: 0, user: 0, emails: 0, lastForm: null as URLSearchParams | null };

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  function takeFailure(kinds: readonly FakeGithubFailure[]): FakeGithubFailure | undefined {
    const next = failures[0];
    if (next === undefined || !kinds.includes(next)) return undefined;
    failures.shift();
    return next;
  }

  function answerToken(init: RequestInit): Response {
    calls.token += 1;
    const form = new URLSearchParams(init.body instanceof URLSearchParams ? init.body : typeof init.body === "string" ? init.body : "");
    calls.lastForm = form;
    const failure = takeFailure(["token_unavailable", "bad_verification_code"]);
    if (failure === "token_unavailable") return json(503, { message: "Service Unavailable" });
    // GitHub answers OAuth errors with status 200.
    if (failure === "bad_verification_code") return json(200, { error: "bad_verification_code" });
    if (new Headers(init.headers).get("accept") !== "application/json") return new Response("access_token=x", { status: 200 });
    if (form.get("client_id") !== clientId || form.get("client_secret") !== clientSecret) return json(200, { error: "incorrect_client_credentials" });
    const code = form.get("code") ?? "";
    const pending = codes.get(code);
    codes.delete(code);
    if (pending === undefined) return json(200, { error: "bad_verification_code" });
    if (form.get("redirect_uri") !== pending.redirectUri) return json(200, { error: "redirect_uri_mismatch" });
    const verifier = form.get("code_verifier") ?? "";
    if (createHash("sha256").update(verifier, "ascii").digest("base64url") !== pending.challenge) return json(200, { error: "bad_verification_code" });
    const accessToken = `gho_${random()}`;
    tokens.set(accessToken, pending.user);
    return json(200, { access_token: accessToken, token_type: "bearer", scope: "read:user,user:email" });
  }

  function answerApi(target: string, init: RequestInit): Response {
    const headers = new Headers(init.headers);
    if (headers.get("user-agent") === null) return json(403, { message: "Request forbidden by administrative rules. Please make sure your request has a User-Agent header" });
    const user = tokens.get((headers.get("authorization") ?? "").replace(/^Bearer /, ""));
    if (target === USER_URL) {
      calls.user += 1;
      if (takeFailure(["api_unavailable"]) !== undefined) return json(503, { message: "Service Unavailable" });
      if (user === undefined) return json(401, { message: "Bad credentials" });
      return json(200, { id: user.id, login: user.login, name: user.name ?? null, type: "User" });
    }
    calls.emails += 1;
    if (user === undefined) return json(401, { message: "Bad credentials" });
    return json(
      200,
      user.emails.map((entry) => ({ email: entry.email, primary: entry.primary ?? false, verified: entry.verified ?? true, visibility: null })),
    );
  }

  function route(input: string | URL, init: RequestInit): Response {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const target = `${url.origin}${url.pathname}`;
    if (target === TOKEN_URL && init.method === "POST") return answerToken(init);
    if ((target === USER_URL || target === EMAILS_URL) && (init.method ?? "GET") === "GET") return answerApi(target, init);
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
    fetch: (input, init) => Promise.resolve(route(input, init)),
    signIn(authorizeUrl, user, signInOptions = {}) {
      const url = new URL(authorizeUrl);
      const query = url.searchParams;
      if (`${url.origin}${url.pathname}` !== AUTHORIZE_URL) throw new Error(`fake GitHub: authorize URL ${url.origin}${url.pathname} is not ${AUTHORIZE_URL}`);
      if (query.get("client_id") !== clientId) throw new Error("fake GitHub: unknown client_id");
      const scopes = (query.get("scope") ?? "").split(" ");
      if (!scopes.includes("read:user") || !scopes.includes("user:email")) throw new Error("fake GitHub: scope lacks read:user or user:email");
      if (query.get("code_challenge_method") !== "S256") throw new Error("fake GitHub: PKCE S256 is required");
      const redirectUri = query.get("redirect_uri");
      const state = query.get("state");
      const challenge = query.get("code_challenge");
      if (redirectUri === null || state === null || challenge === null) throw new Error("fake GitHub: redirect_uri, state and code_challenge are required");
      const callback = new URL(redirectUri);
      callback.searchParams.set("state", state);
      if (signInOptions.deny === true) {
        callback.searchParams.set("error", "access_denied");
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
