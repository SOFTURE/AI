// The OAuth authorization code flow (RFC 6749 §4.1) with PKCE S256 (RFC 7636). `startAuthorization` stores a
// one-time state (its sha256 only) bound to the admin who started it, with the PKCE verifier sealed, and answers
// the provider's authorize URL. `completeAuthorization` consumes that state on the callback, exchanges the code
// and stores the connection, sealed. Nothing a provider says is echoed: failures are codes.
import { createHash, randomBytes } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq, gt, lte } from "drizzle-orm";
import type { ConnectionsFlowErrorCode } from "../contract.js";
import { DEFAULT_ACCOUNT_ID, type OAuthProviderDefinition } from "../options.js";
import { accounts, oauthStates } from "../schema.js";
import { getCredentialContext, getVerifierContext, openSecret, sealSecret, type Keyring } from "./crypto.js";
import { findProvider, getConnectionsOptions, getRedirectUri, readClientCredentials } from "./options.js";
import { getKeyring, parseScopes, type ConnectionsContext } from "./store.js";
import { requestTokens, type TokenResponse } from "./token-client.js";

const RANDOM_BYTES = 32;

export interface StartAuthorizationInput {
  readonly provider: string;
  readonly accountId?: string;
  /** The auth user id of the admin; only they can complete it. */
  readonly actorId: string;
}

export type StartAuthorizationResult = Ok<{ readonly url: string }> | Err<ConnectionsFlowErrorCode>;

/** Stores a new authorization and answers the URL to send the admin's browser to. */
export async function startAuthorization(ctx: ConnectionsContext, input: StartAuthorizationInput): Promise<StartAuthorizationResult> {
  const accountId = input.accountId ?? DEFAULT_ACCOUNT_ID;
  const found = findProvider(ctx.config, input.provider, accountId);
  if (!found.ok) return found;
  const provider = found.value;
  if (provider.kind !== "oauth") return err("connections.wrong_kind");
  // The secret is checked here too, so a missing one shows on the page instead of after the consent screen.
  const client = readClientCredentials(provider, ctx.env);
  if (!client.ok) return client;
  const keyring = getKeyring(ctx);
  if (!keyring.ok) return keyring;

  const now = ctx.clock.now();
  const options = getConnectionsOptions(ctx.config);
  const state = randomBytes(RANDOM_BYTES).toString("base64url");
  const stateHash = hashState(state);
  const verifier = provider.pkce ? randomBytes(RANDOM_BYTES).toString("base64url") : null;
  const sealedVerifier = verifier === null ? null : sealSecret(keyring.value, verifier, getVerifierContext(stateHash));

  await ctx.db.delete(oauthStates).where(lte(oauthStates.expiresAt, now));
  await ctx.db.insert(oauthStates).values({
    stateHash,
    provider: provider.id,
    accountId,
    keyId: sealedVerifier?.keyId ?? keyring.value.current.id,
    verifier: sealedVerifier?.sealed ?? null,
    createdBy: input.actorId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + options.stateTtlMinutes * 60_000),
  });

  return ok({ url: buildAuthorizeUrl(ctx, provider, client.value.clientId, state, verifier) });
}

function buildAuthorizeUrl(ctx: ConnectionsContext, provider: OAuthProviderDefinition, clientId: string, state: string, verifier: string | null): string {
  const url = new URL(provider.authorizeUrl);
  for (const [name, value] of Object.entries(provider.authorizeParams)) url.searchParams.set(name, value);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri(ctx.config));
  if (provider.scopes.length > 0) url.searchParams.set("scope", provider.scopes.join(provider.scopeSeparator));
  url.searchParams.set("state", state);
  if (verifier !== null) {
    url.searchParams.set("code_challenge", createHash("sha256").update(verifier, "ascii").digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

/** The callback's query: `code` and `state`, or `error` and `state`. */
export interface CallbackParams {
  readonly state: string | null;
  readonly code: string | null;
  readonly error: string | null;
}

export interface CompleteAuthorizationInput {
  readonly params: CallbackParams;
  /** The auth user id of the admin whose browser came back. */
  readonly actorId: string;
}

export type CompleteAuthorizationResult = Ok<{ readonly provider: string; readonly accountId: string }> | Err<ConnectionsFlowErrorCode>;

/** Consumes the authorization the callback names, exchanges its code and stores the connection. */
export async function completeAuthorization(ctx: ConnectionsContext, input: CompleteAuthorizationInput): Promise<CompleteAuthorizationResult> {
  const { state, code, error } = input.params;
  if (state === null || state.length > 512) return err("connections.state_invalid");
  const now = ctx.clock.now();
  const stateHash = hashState(state);
  // One-time: the row is gone whatever happens next. Another user's session cannot consume (or burn) it.
  const [pending] = await ctx.db
    .delete(oauthStates)
    .where(and(eq(oauthStates.stateHash, stateHash), eq(oauthStates.createdBy, input.actorId), gt(oauthStates.expiresAt, now)))
    .returning();
  if (pending === undefined) return err("connections.state_invalid");
  if (error !== null) return err(error === "access_denied" ? "connections.consent_denied" : "connections.authorization_failed");
  if (code === null || code === "" || code.length > 4096) return err("connections.authorization_failed");

  const found = findProvider(ctx.config, pending.provider, pending.accountId);
  if (!found.ok) return found;
  const provider = found.value;
  if (provider.kind !== "oauth") return err("connections.wrong_kind");
  const client = readClientCredentials(provider, ctx.env);
  if (!client.ok) return client;
  const keyring = getKeyring(ctx);
  if (!keyring.ok) return keyring;

  const params: Record<string, string> = { grant_type: "authorization_code", code, redirect_uri: getRedirectUri(ctx.config) };
  if (pending.verifier !== null) {
    const verifier = openSecret(keyring.value, pending.verifier, getVerifierContext(stateHash));
    if (!verifier.ok) return verifier;
    params.code_verifier = verifier.value;
  }
  const options = getConnectionsOptions(ctx.config);
  const answer = await requestTokens({
    provider,
    client: client.value,
    params,
    fetch: options.fetch ?? globalThis.fetch,
    timeoutMs: options.httpTimeoutMs,
  });
  if (answer.kind === "oauth_error") {
    return err(answer.error === "invalid_client" || answer.error === "unauthorized_client" ? "connections.client_rejected" : "connections.exchange_failed");
  }
  if (answer.kind === "failed") return err("connections.exchange_failed");

  await storeGrant(ctx, keyring.value, { provider, accountId: pending.accountId, tokens: answer.tokens, actorId: input.actorId });
  return ok({ provider: provider.id, accountId: pending.accountId });
}

interface StoreGrantInput {
  readonly provider: OAuthProviderDefinition;
  readonly accountId: string;
  readonly tokens: TokenResponse;
  readonly actorId: string | null;
}

/** Stores a new grant for the provider's account, replacing whatever was there (a reconnect). */
async function storeGrant(ctx: ConnectionsContext, keyring: Keyring, input: StoreGrantInput): Promise<void> {
  const now = ctx.clock.now();
  const { tokens, provider } = input;
  const sealed = sealSecret(
    keyring,
    JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
    getCredentialContext(provider.id, input.accountId),
  );
  const values = {
    kind: "oauth" as const,
    status: "connected" as const,
    keyId: sealed.keyId,
    credentials: sealed.sealed,
    tokenType: tokens.tokenType,
    scopes: parseScopes(tokens.scope, provider.scopes),
    hasRefreshToken: tokens.refreshToken !== null,
    expiresAt: addSeconds(now, tokens.expiresIn),
    refreshExpiresAt: getRefreshExpiry(now, provider, tokens),
    connectedAt: now,
    connectedBy: input.actorId,
    refreshedAt: null,
    lastError: null,
    lastErrorAt: null,
    updatedAt: now,
    leaseId: null,
    leaseUntil: null,
  };
  await ctx.db
    .insert(accounts)
    .values({ provider: provider.id, accountId: input.accountId, ...values })
    .onConflictDoUpdate({ target: [accounts.provider, accounts.accountId], set: values });
}

/** When the refresh token dies: as the provider said, else its configured maximum age, else unknown. */
export function getRefreshExpiry(now: Date, provider: OAuthProviderDefinition, tokens: TokenResponse): Date | null {
  if (tokens.refreshToken === null) return null;
  if (tokens.refreshTokenExpiresIn !== null) return addSeconds(now, tokens.refreshTokenExpiresIn);
  return provider.refreshTokenMaxAgeDays === undefined ? null : addSeconds(now, provider.refreshTokenMaxAgeDays * 86_400);
}

export function addSeconds(now: Date, seconds: number | null): Date | null {
  return seconds === null ? null : new Date(now.getTime() + seconds * 1000);
}

/** The stored form of a state: base64url sha256, 43 characters. */
export function hashState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("base64url");
}
