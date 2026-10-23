// `getAccessToken`: a usable access token for a provider account, refreshed first when it is close to expiry.
// A refresh runs under the row's lease (a conditional update, never a row lock held across the network call),
// so two workers never spend one refresh token twice; the other callers wait for the new token and read it.
// `invalid_grant` is terminal (`reconnect_required`, the app's hook runs once); everything else is retryable.
import { randomUUID } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import type { AccessToken, ConnectionsTokenErrorCode } from "../contract.js";
import { DEFAULT_ACCOUNT_ID, type OAuthProviderDefinition } from "../options.js";
import { accounts, type AccountRow } from "../schema.js";
import { getCredentialContext, sealSecret, type Keyring } from "./crypto.js";
import { addSeconds, getRefreshExpiry } from "./flow.js";
import { findProvider, getConnectionsOptions, readClientCredentials } from "./options.js";
import { findAccount, getKeyring, markReconnectRequired, openOAuthSecrets, parseScopes, releaseLease, type ConnectionsContext } from "./store.js";
import { requestTokens } from "./token-client.js";

export interface GetAccessTokenInput {
  readonly provider: string;
  /** One of the provider's `accounts`; `default` when omitted. */
  readonly accountId?: string;
  /**
   * Refresh now, even when the stored token is not close to expiry (the provider refused it early). Same lease,
   * same `invalid_grant` handling; without a refresh token the stored token is answered as it is.
   */
  readonly forceRefresh?: boolean;
}

export type GetAccessTokenResult = Ok<AccessToken> | Err<ConnectionsTokenErrorCode>;

/** A usable access token for the provider account, refreshed when it expires within `refreshSkewSeconds`. */
export async function getAccessToken(ctx: ConnectionsContext, input: GetAccessTokenInput): Promise<GetAccessTokenResult> {
  return readAccessToken(ctx, input, input.forceRefresh === true ? { rejectedToken: null } : null);
}

export interface ReplaceRejectedTokenInput {
  readonly provider: string;
  readonly accountId?: string;
  /** The access token the provider just refused. */
  readonly rejectedToken: string;
}

/**
 * A forced refresh only while the stored access token is still the refused one: callers that saw a 401 for the
 * same token at the same time spend one refresh, and the others read its result.
 */
export async function replaceRejectedToken(ctx: ConnectionsContext, input: ReplaceRejectedTokenInput): Promise<GetAccessTokenResult> {
  return readAccessToken(ctx, input, { rejectedToken: input.rejectedToken });
}

/** A refresh regardless of expiry; `rejectedToken` limits it to a stored token equal to that one. */
interface ForceRefresh {
  readonly rejectedToken: string | null;
}

async function readAccessToken(ctx: ConnectionsContext, input: ProviderAccount, force: ForceRefresh | null): Promise<GetAccessTokenResult> {
  const accountId = input.accountId ?? DEFAULT_ACCOUNT_ID;
  const found = findProvider(ctx.config, input.provider, accountId);
  if (!found.ok) return found;
  const provider = found.value;
  if (provider.kind !== "oauth") return err("connections.wrong_kind");
  const keyring = getKeyring(ctx);
  if (!keyring.ok) return keyring;
  const row = await findAccount(ctx, provider.id, accountId);
  if (row === undefined) return err("connections.not_connected");
  return resolveToken(ctx, { provider, keyring: keyring.value, row, mayWait: true, force });
}

interface ProviderAccount {
  readonly provider: string;
  readonly accountId?: string;
}

interface ResolveInput {
  readonly provider: OAuthProviderDefinition;
  readonly keyring: Keyring;
  readonly row: AccountRow;
  /** Whether to wait for another worker's refresh; false on the second try after a wait. */
  readonly mayWait: boolean;
  /** Refresh even when the token is fresh; null for the usual expiry rule. */
  readonly force: ForceRefresh | null;
}

async function resolveToken(ctx: ConnectionsContext, input: ResolveInput): Promise<GetAccessTokenResult> {
  const { row, keyring } = input;
  if (row.status === "reconnect_required") return err("connections.reconnect_required");
  const now = ctx.clock.now();
  if (input.force === null ? isFresh(ctx, row, now) : !isRejected(keyring, row, input.force)) return toAccessToken(keyring, row);
  if (!row.hasRefreshToken) {
    // Nothing to refresh with: usable until it expires, then only a reconnect helps.
    if (row.expiresAt !== null && row.expiresAt > now) return toAccessToken(keyring, row);
    await markReconnectRequired(ctx, { rowId: row.id, provider: row.provider, accountId: row.accountId, kind: "oauth", reason: "expired" });
    return err("connections.reconnect_required");
  }

  const leaseId = randomUUID();
  const leaseUntil = new Date(now.getTime() + getConnectionsOptions(ctx.config).refreshLeaseSeconds * 1000);
  const [leased] = await ctx.db
    .update(accounts)
    .set({ leaseId, leaseUntil })
    .where(and(eq(accounts.id, row.id), eq(accounts.status, "connected"), or(isNull(accounts.leaseUntil), lte(accounts.leaseUntil, now))))
    .returning();
  if (leased === undefined) return input.mayWait ? waitForRefresh(ctx, input) : err("connections.refresh_in_progress");
  // Another worker may have finished a refresh between the read and the lease.
  if ((input.force === null && isFresh(ctx, leased, now)) || leased.credentials !== row.credentials) {
    await releaseLease(ctx, leased.id, leaseId);
    return toAccessToken(keyring, leased);
  }
  return refreshUnderLease(ctx, input.provider, keyring, leased, leaseId);
}

async function refreshUnderLease(
  ctx: ConnectionsContext,
  provider: OAuthProviderDefinition,
  keyring: Keyring,
  row: AccountRow,
  leaseId: string,
): Promise<GetAccessTokenResult> {
  const secrets = openOAuthSecrets(keyring, row);
  if (!secrets.ok) {
    await releaseLease(ctx, row.id, leaseId);
    return secrets;
  }
  const refreshToken = secrets.value.refreshToken;
  if (refreshToken === null) {
    // `has_refresh_token` said otherwise; the sealed payload is the truth.
    await markReconnectRequired(ctx, { rowId: row.id, provider: row.provider, accountId: row.accountId, kind: "oauth", reason: "expired", leaseId });
    return err("connections.reconnect_required");
  }
  const client = readClientCredentials(provider, ctx.env);
  if (!client.ok) {
    await releaseLease(ctx, row.id, leaseId);
    return client;
  }

  const options = getConnectionsOptions(ctx.config);
  const answer = await requestTokens({
    provider,
    client: client.value,
    params: { grant_type: "refresh_token", refresh_token: refreshToken },
    fetch: options.fetch ?? globalThis.fetch,
    timeoutMs: options.httpTimeoutMs,
  });

  if (answer.kind === "oauth_error" && answer.error === "invalid_grant") {
    await markReconnectRequired(ctx, { rowId: row.id, provider: row.provider, accountId: row.accountId, kind: "oauth", reason: "invalid_grant", leaseId });
    return err("connections.reconnect_required");
  }
  if (answer.kind !== "tokens") {
    const code = answer.kind === "oauth_error" && (answer.error === "invalid_client" || answer.error === "unauthorized_client") ? "connections.client_rejected" : "connections.refresh_failed";
    await recordFailure(ctx, row.id, leaseId, code);
    return err(code);
  }

  const now = ctx.clock.now();
  const tokens = answer.tokens;
  // A provider that rotates spends the old refresh token: without a new one, the grant ends when this token does.
  const nextRefreshToken = tokens.refreshToken ?? (provider.rotatesRefreshToken ? null : refreshToken);
  const sealed = sealSecret(keyring, JSON.stringify({ accessToken: tokens.accessToken, refreshToken: nextRefreshToken }), getCredentialContext(row.provider, row.accountId));
  const isNewRefreshToken = tokens.refreshToken !== null;
  const values = {
    keyId: sealed.keyId,
    credentials: sealed.sealed,
    tokenType: tokens.tokenType,
    scopes: tokens.scope === null ? row.scopes : parseScopes(tokens.scope, row.scopes),
    hasRefreshToken: nextRefreshToken !== null,
    expiresAt: addSeconds(now, tokens.expiresIn),
    refreshExpiresAt: nextRefreshToken === null ? null : isNewRefreshToken ? getRefreshExpiry(now, provider, tokens) : row.refreshExpiresAt,
    refreshedAt: now,
    lastError: null,
    lastErrorAt: null,
    updatedAt: now,
    leaseId: null,
    leaseUntil: null,
  };
  const stored = await ctx.db
    .update(accounts)
    .set(values)
    .where(and(eq(accounts.id, row.id), eq(accounts.leaseId, leaseId)))
    .returning({ id: accounts.id });
  if (stored.length === 0) {
    // The lease ran out before the provider answered and another worker took it. The token is valid; the
    // stored grant is that worker's.
    console.error(`@softure-ai/connections: the refresh lease of ${row.provider}/${row.accountId} expired before the answer was stored`);
  }
  return ok({ accessToken: tokens.accessToken, tokenType: tokens.tokenType, expiresAt: values.expiresAt, scopes: values.scopes });
}

/** Polls the row while another worker holds its lease; answers the new token, or tries once more when the lease is gone. */
async function waitForRefresh(ctx: ConnectionsContext, input: ResolveInput): Promise<GetAccessTokenResult> {
  const { attempts, intervalMs } = getConnectionsOptions(ctx.config).refreshWait;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const row = await findAccount(ctx, input.row.provider, input.row.accountId);
    if (row === undefined) return err("connections.not_connected");
    if (row.status === "reconnect_required") return err("connections.reconnect_required");
    // The other worker stored a new token: it is the refresh this caller asked for, forced or not.
    if (row.credentials !== input.row.credentials) return resolveToken(ctx, { ...input, row, mayWait: false, force: null });
    if (row.leaseUntil === null || row.leaseUntil <= ctx.clock.now()) {
      // The other worker gave up (a retryable failure) or died: one attempt of our own.
      return resolveToken(ctx, { ...input, row, mayWait: false });
    }
  }
  return err("connections.refresh_in_progress");
}

async function recordFailure(ctx: ConnectionsContext, rowId: string, leaseId: string, code: ConnectionsTokenErrorCode): Promise<void> {
  const now = ctx.clock.now();
  await ctx.db
    .update(accounts)
    .set({ lastError: code, lastErrorAt: now, updatedAt: now, leaseId: null, leaseUntil: null })
    .where(and(eq(accounts.id, rowId), eq(accounts.leaseId, leaseId)));
}

function isFresh(ctx: ConnectionsContext, row: AccountRow, now: Date): boolean {
  const skew = getConnectionsOptions(ctx.config).refreshSkewSeconds * 1000;
  return row.expiresAt === null || row.expiresAt.getTime() - now.getTime() > skew;
}

/** Whether a forced refresh applies to this row: always, or while it still holds the refused token. */
function isRejected(keyring: Keyring, row: AccountRow, force: ForceRefresh): boolean {
  if (force.rejectedToken === null) return true;
  const secrets = openOAuthSecrets(keyring, row);
  // An unreadable row fails the same way in `toAccessToken`; refreshing would not open it either.
  return secrets.ok && secrets.value.accessToken === force.rejectedToken;
}

function toAccessToken(keyring: Keyring, row: AccountRow): GetAccessTokenResult {
  const secrets = openOAuthSecrets(keyring, row);
  if (!secrets.ok) return secrets;
  return ok({ accessToken: secrets.value.accessToken, tokenType: row.tokenType ?? "Bearer", expiresAt: row.expiresAt, scopes: row.scopes });
}
