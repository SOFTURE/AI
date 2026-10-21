// An in-memory OAuth 2.0 authorization server for tests: authorize (`consent`), token (authorization code with
// PKCE S256, refresh with optional rotation) and RFC 7009 revocation, reached through a `fetch` the app's
// `connections({ fetch })` takes. It checks what a real provider checks (client credentials, redirect URI, PKCE
// verifier, one-time codes, live refresh tokens) and lets a test break it: a revoked grant (`invalid_grant`),
// an outage, a rate limit, a refused client, an unreadable answer, a slow answer.
import { createHash, randomBytes } from "node:crypto";
import type { FetchFunction } from "@softure-ai/core";
import type { ProviderDefinitionInput } from "../options.js";

export interface FakeOAuthProviderOptions {
  /** The provider id. Default `fake`. */
  readonly id?: string;
  /** Default `https://fake-oauth.test`. */
  readonly origin?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  /** The variable the definition names for the secret; `env` holds it. Default `FAKE_OAUTH_CLIENT_SECRET`. */
  readonly clientSecretEnv?: string;
  readonly clientAuth?: "body" | "basic";
  readonly scopes?: readonly string[];
  /** Scopes the fake grants, when they differ from the requested ones (a user unticked one). */
  readonly grantedScopes?: readonly string[];
  /** Access token lifetime; null answers without `expires_in`. Default 3600. */
  readonly accessTokenTtlSeconds?: number | null;
  /** Whether a grant carries a refresh token. Default true. */
  readonly issuesRefreshToken?: boolean;
  /** Spend a refresh token on use and answer with a new one. Default false. */
  readonly rotatesRefreshToken?: boolean;
  /** Answer `refresh_token_expires_in`. */
  readonly refreshTokenTtlSeconds?: number;
  readonly accounts?: readonly string[];
}

/** A failure the next token or revoke calls answer with, in order. */
export type FakeFailure = "unreachable" | "unavailable" | "rate_limited" | "invalid_client" | "malformed" | "redirect" | "error_with_200";

export interface FakeOAuthProvider {
  /** The provider entry for `connections({ providers: [fake.definition] })`. */
  readonly definition: ProviderDefinitionInput;
  /** The environment the definition needs (its client secret), for the module context's `env`. */
  readonly env: Readonly<Record<string, string>>;
  /** The `fetch` for `connections({ fetch })`. */
  readonly fetch: FetchFunction;
  /**
   * The user at the provider's consent screen: checks the authorize URL and answers the callback URL the provider
   * redirects to, with `code` and `state`, or `error=access_denied` when denied.
   */
  consent(authorizeUrl: string, options?: { readonly deny?: boolean }): URL;
  /** Every live refresh token dies: the next refresh answers `invalid_grant` (consent revoked, testing mode). */
  revokeGrant(): void;
  /** The next calls to the token or revoke endpoint fail like this, one per entry. */
  failNext(...failures: FakeFailure[]): void;
  /** Delays every token answer, for overlapping refreshes. */
  setDelay(milliseconds: number): void;
  /** Whether the provider would accept this access token. */
  isAccessTokenValid(token: string): boolean;
  /** What the provider saw. */
  readonly calls: {
    readonly authorizationCode: number;
    readonly refresh: number;
    readonly revoke: number;
    /** The form of the last token or revoke call, client secret included, for assertions. */
    readonly lastForm: URLSearchParams | null;
    readonly lastAuthorization: string | null;
  };
}

interface PendingCode {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly challenge: string | null;
  readonly scope: string;
}

const random = () => randomBytes(24).toString("base64url");

export function createFakeOAuthProvider(options: FakeOAuthProviderOptions = {}): FakeOAuthProvider {
  const id = options.id ?? "fake";
  const origin = options.origin ?? "https://fake-oauth.test";
  const clientId = options.clientId ?? "fake-client";
  const clientSecret = options.clientSecret ?? "fake-client-secret";
  const clientSecretEnv = options.clientSecretEnv ?? "FAKE_OAUTH_CLIENT_SECRET";
  const scopes = [...(options.scopes ?? ["read", "write"])];
  const ttl = options.accessTokenTtlSeconds === undefined ? 3600 : options.accessTokenTtlSeconds;
  const issuesRefreshToken = options.issuesRefreshToken ?? true;
  const rotates = options.rotatesRefreshToken ?? false;
  const urls = { authorize: `${origin}/authorize`, token: `${origin}/token`, revoke: `${origin}/revoke` };

  const codes = new Map<string, PendingCode>();
  const refreshTokens = new Map<string, string>();
  const accessTokens = new Set<string>();
  const failures: FakeFailure[] = [];
  let delay = 0;
  const calls = { authorizationCode: 0, refresh: 0, revoke: 0, lastForm: null as URLSearchParams | null, lastAuthorization: null as string | null };

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  function issue(scope: string, refreshToken: string | null): Response {
    const accessToken = `at-${random()}`;
    accessTokens.add(accessToken);
    const body: Record<string, unknown> = { access_token: accessToken, token_type: "Bearer", scope };
    if (ttl !== null) body.expires_in = ttl;
    if (refreshToken !== null) body.refresh_token = refreshToken;
    if (refreshToken !== null && options.refreshTokenTtlSeconds !== undefined) body.refresh_token_expires_in = options.refreshTokenTtlSeconds;
    return json(200, body);
  }

  function newRefreshToken(scope: string): string {
    const token = `rt-${random()}`;
    refreshTokens.set(token, scope);
    return token;
  }

  function readClient(form: URLSearchParams, authorization: string | null): { id: string | null; secret: string | null } {
    if (authorization?.startsWith("Basic ") === true) {
      const [user, password] = Buffer.from(authorization.slice(6), "base64").toString("utf8").split(":");
      return { id: user === undefined ? null : decodeURIComponent(user), secret: password === undefined ? null : decodeURIComponent(password) };
    }
    return { id: form.get("client_id"), secret: form.get("client_secret") };
  }

  function answerFailure(failure: FakeFailure): Response {
    switch (failure) {
      case "unreachable":
        throw new TypeError(`fetch failed: ${urls.token}`);
      case "unavailable":
        return json(503, { error: "temporarily_unavailable" });
      case "rate_limited":
        return new Response("slow down", { status: 429 });
      case "invalid_client":
        return json(401, { error: "invalid_client" });
      case "malformed":
        return new Response("<html>oops</html>", { status: 200 });
      case "redirect":
        return new Response(null, { status: 302, headers: { location: "https://elsewhere.test/" } });
      case "error_with_200":
        return json(200, { error: "bad_verification_code", error_description: "The code passed is incorrect or expired." });
    }
  }

  function handleToken(form: URLSearchParams, authorization: string | null): Response {
    const client = readClient(form, authorization);
    if (client.id !== clientId || client.secret !== clientSecret) return json(401, { error: "invalid_client" });
    const grantType = form.get("grant_type");
    if (grantType === "authorization_code") {
      calls.authorizationCode += 1;
      const code = form.get("code") ?? "";
      const pending = codes.get(code);
      codes.delete(code);
      if (pending?.clientId !== clientId || pending.redirectUri !== form.get("redirect_uri")) return json(400, { error: "invalid_grant" });
      if (pending.challenge !== null) {
        const verifier = form.get("code_verifier") ?? "";
        if (createHash("sha256").update(verifier, "ascii").digest("base64url") !== pending.challenge) return json(400, { error: "invalid_grant" });
      }
      return issue(pending.scope, issuesRefreshToken ? newRefreshToken(pending.scope) : null);
    }
    if (grantType === "refresh_token") {
      calls.refresh += 1;
      const token = form.get("refresh_token") ?? "";
      const scope = refreshTokens.get(token);
      if (scope === undefined) return json(400, { error: "invalid_grant", error_description: `refresh token ${token} is not valid` });
      if (!rotates) return issue(scope, null);
      refreshTokens.delete(token);
      return issue(scope, newRefreshToken(scope));
    }
    return json(400, { error: "unsupported_grant_type" });
  }

  const fetch: FetchFunction = async (input, init) => {
    const url = String(input);
    const form = new URLSearchParams(typeof init.body === "string" ? init.body : "");
    const authorization = new Headers(init.headers).get("authorization");
    calls.lastForm = form;
    calls.lastAuthorization = authorization;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    const failure = failures.shift();
    if (failure !== undefined) return answerFailure(failure);
    if (url === urls.token && init.method === "POST") return handleToken(form, authorization);
    if (url === urls.revoke && init.method === "POST") {
      calls.revoke += 1;
      const token = form.get("token") ?? "";
      refreshTokens.delete(token);
      accessTokens.delete(token);
      return new Response(null, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  return {
    definition: {
      kind: "oauth",
      id,
      label: { en: "Fake provider" },
      ...(options.accounts === undefined ? {} : { accounts: [...options.accounts] }),
      authorizeUrl: urls.authorize,
      tokenUrl: urls.token,
      revokeUrl: urls.revoke,
      scopes,
      clientId,
      clientSecretEnv,
      clientAuth: options.clientAuth ?? "body",
      rotatesRefreshToken: rotates,
    },
    env: { [clientSecretEnv]: clientSecret },
    fetch,
    consent(authorizeUrl, consentOptions = {}) {
      const url = new URL(authorizeUrl);
      if (`${url.origin}${url.pathname}` !== urls.authorize) throw new Error(`fake provider: not its authorize URL: ${authorizeUrl}`);
      const params = url.searchParams;
      const redirectUri = params.get("redirect_uri");
      const state = params.get("state");
      if (params.get("response_type") !== "code" || params.get("client_id") !== clientId || redirectUri === null || state === null) {
        throw new Error("fake provider: the authorize URL lacks response_type=code, the client id, redirect_uri or state");
      }
      const callback = new URL(redirectUri);
      callback.searchParams.set("state", state);
      if (consentOptions.deny === true) {
        callback.searchParams.set("error", "access_denied");
        return callback;
      }
      const method = params.get("code_challenge_method");
      const challenge = params.get("code_challenge");
      if (challenge !== null && method !== "S256") throw new Error("fake provider: only S256 is accepted");
      const code = `code-${random()}`;
      const scope = (options.grantedScopes ?? params.get("scope")?.split(/[ ,]/) ?? []).join(" ");
      codes.set(code, { clientId, redirectUri, challenge, scope });
      callback.searchParams.set("code", code);
      return callback;
    },
    revokeGrant() {
      refreshTokens.clear();
    },
    failNext(...next) {
      failures.push(...next);
    },
    setDelay(milliseconds) {
      delay = milliseconds;
    },
    isAccessTokenValid(token) {
      return accessTokens.has(token);
    },
    calls,
  };
}
