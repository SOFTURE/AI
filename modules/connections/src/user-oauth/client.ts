// The OAuth 2.0 authorization code flow for a grant that belongs to one of the app's users: the authorize URL, the
// code exchange, a refresh and a revocation. Stateless: the app keeps the state record and the sealed grant beside its
// own rows (`sealUserSecret`), keyed by its user. The calls go through the module's token client (core's
// `requestJson`: a timeout, no redirect followed, failures as codes); no token, secret or provider message reaches an
// error or a log.
import { requestJson, systemClock, type Clock, type FetchFunction } from "@softure-ai/core";
import { requestTokens, revokeToken, type TokenCallResult, type TokenResponse } from "../server/token-client.js";
import type { UserOAuthClient, UserOAuthProvider } from "./provider.js";
import { createCodeChallenge } from "./state.js";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface UserOAuthCallOptions {
  /** The `fetch` the calls use; tests pass a fake provider's. Default the global one. */
  readonly fetch?: FetchFunction;
  /** The clock the expiry is computed with. Default the system clock. */
  readonly clock?: Clock;
  readonly timeoutMs?: number;
}

/** Why a call did not give a grant. */
export type UserOAuthFailureCode =
  /** The provider refused the code or the client (an OAuth error other than a dead refresh token). */
  | "connections.user_oauth_rejected"
  /** A refresh answered `invalid_grant`: the user revoked the app, or the grant expired. Only a new consent helps. */
  | "connections.user_oauth_reconnect_required"
  /** No answer, a timeout, 429, 5xx, a redirect, or an answer that is neither tokens nor an OAuth error: retry. */
  | "connections.user_oauth_unavailable";

export interface UserOAuthFailure {
  readonly ok: false;
  readonly error: UserOAuthFailureCode;
  /** The token endpoint's HTTP status; null when no answer came. */
  readonly status: number | null;
  /** The OAuth `error` code the provider answered (`invalid_grant`); null when it answered none. */
  readonly oauthError: string | null;
}

export type UserOAuthResult<T> = { readonly ok: true; readonly value: T } | UserOAuthFailure;

/** A user's grant as the token endpoint answered it. Secret: store it only sealed (`sealUserSecret`). */
export interface UserOAuthGrant {
  readonly accessToken: string;
  readonly tokenType: string;
  /** The refresh token to keep: a new one when the provider rotated it, else the one the refresh used; null without. */
  readonly refreshToken: string | null;
  /** When the access token expires; null when the provider gave no expiry. */
  readonly expiresAt: Date | null;
  /** When the refresh token dies, when the provider said (`refresh_token_expires_in`). */
  readonly refreshExpiresAt: Date | null;
  /** The scopes granted, as the provider listed them; the requested ones when it listed none. */
  readonly scopes: readonly string[];
  /** The answer's own identifiers of the grant (`account_id`, `uid`), never a token. */
  readonly fields: Readonly<Record<string, string>>;
}

export interface UserAuthorizationUrlInput {
  readonly redirectUri: string;
  readonly state: string;
  /** The PKCE verifier; required when the provider runs PKCE, ignored otherwise. */
  readonly codeVerifier?: string;
}

/** The provider's consent page for this authorization. */
export async function buildUserAuthorizationUrl(provider: UserOAuthProvider, client: Pick<UserOAuthClient, "clientId">, input: UserAuthorizationUrlInput): Promise<URL> {
  const url = new URL(provider.authorizeUrl);
  for (const [name, value] of Object.entries(provider.authorizeParams)) url.searchParams.set(name, value);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  if (provider.scopes.length > 0) url.searchParams.set("scope", provider.scopes.join(provider.scopeSeparator));
  if (provider.pkce) {
    if (input.codeVerifier === undefined) throw new TypeError("buildUserAuthorizationUrl: the provider runs PKCE, so a codeVerifier is required");
    url.searchParams.set("code_challenge", await createCodeChallenge(input.codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url;
}

export interface UserCodeExchangeInput {
  readonly code: string;
  /** The redirect URI the authorize URL named, exactly. */
  readonly redirectUri: string;
  /** The verifier stored with the state; required when the provider runs PKCE. */
  readonly codeVerifier?: string;
}

/** Exchanges the callback's code for the user's grant. */
export async function exchangeUserCode(
  provider: UserOAuthProvider,
  client: UserOAuthClient,
  input: UserCodeExchangeInput,
  options: UserOAuthCallOptions = {},
): Promise<UserOAuthResult<UserOAuthGrant>> {
  const params: Record<string, string> = { grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri };
  if (provider.pkce) {
    if (input.codeVerifier === undefined) throw new TypeError("exchangeUserCode: the provider runs PKCE, so a codeVerifier is required");
    params.code_verifier = input.codeVerifier;
  }
  const answer = await callTokenEndpoint(provider, client, params, options);
  return toGrant(answer, provider, null, options, false);
}

/**
 * A fresh access token for a stored refresh token. With a rotating provider the answer carries the new refresh token,
 * which the app stores before it uses the access token; a dead refresh token is `connections.user_oauth_reconnect_required`.
 */
export async function refreshUserAccessToken(
  provider: UserOAuthProvider,
  client: UserOAuthClient,
  refreshToken: string,
  options: UserOAuthCallOptions = {},
): Promise<UserOAuthResult<UserOAuthGrant>> {
  const answer = await callTokenEndpoint(provider, client, { grant_type: "refresh_token", refresh_token: refreshToken }, options);
  return toGrant(answer, provider, refreshToken, options, true);
}

/**
 * Revokes a user's grant, best effort, when the user disconnects or the app refuses a grant it just got. RFC 7009 takes
 * either token (the refresh token ends the whole grant); the bearer style takes the access token. Answers whether the
 * provider confirmed it; false when the provider has no revocation endpoint.
 */
export async function revokeUserGrant(provider: UserOAuthProvider, client: UserOAuthClient, token: string, options: UserOAuthCallOptions = {}): Promise<boolean> {
  if (provider.revoke === undefined) return false;
  const fetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (provider.revoke.style === "rfc7009") {
    return revokeToken({ provider, client, params: { token }, fetch, timeoutMs, revokeUrl: provider.revoke.url });
  }
  const answer = await requestJson({ url: provider.revoke.url, method: "POST", headers: { authorization: `Bearer ${token}` }, fetch, timeoutMs });
  return answer.ok;
}

function callTokenEndpoint(provider: UserOAuthProvider, client: UserOAuthClient, params: Record<string, string>, options: UserOAuthCallOptions): Promise<TokenCallResult> {
  return requestTokens({ provider, client, params, fetch: options.fetch ?? globalThis.fetch, timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS });
}

function toGrant(answer: TokenCallResult, provider: UserOAuthProvider, previousRefreshToken: string | null, options: UserOAuthCallOptions, isRefresh: boolean): UserOAuthResult<UserOAuthGrant> {
  if (answer.kind === "oauth_error") {
    const error = isRefresh && answer.error === "invalid_grant" ? "connections.user_oauth_reconnect_required" : "connections.user_oauth_rejected";
    return { ok: false, error, status: answer.status, oauthError: answer.error };
  }
  if (answer.kind === "failed") return { ok: false, error: "connections.user_oauth_unavailable", status: answer.status, oauthError: null };
  return { ok: true, value: readGrant(answer.tokens, provider, previousRefreshToken, (options.clock ?? systemClock).now()) };
}

function readGrant(tokens: TokenResponse, provider: UserOAuthProvider, previousRefreshToken: string | null, now: Date): UserOAuthGrant {
  return {
    accessToken: tokens.accessToken,
    tokenType: tokens.tokenType,
    refreshToken: tokens.refreshToken ?? previousRefreshToken,
    expiresAt: tokens.expiresIn === null ? null : new Date(now.getTime() + tokens.expiresIn * 1000),
    refreshExpiresAt: tokens.refreshTokenExpiresIn === null ? null : new Date(now.getTime() + tokens.refreshTokenExpiresIn * 1000),
    scopes: tokens.scope === null ? [...provider.scopes] : tokens.scope.split(/[\s,]+/).filter((scope) => scope !== ""),
    fields: tokens.fields,
  };
}
