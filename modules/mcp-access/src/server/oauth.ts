// The OAuth 2.1 authorization server's data layer (an adopting app's OAuth code, generalised onto
// the module context). Every secret (code, refresh token, client secret) leaves this file once and
// is stored as its sha256; expiry sits in the queries. An access token issued here is a row of
// `access_tokens` with its grant, so the endpoint verifies it like any other token.
import { timingSafeEqual } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, desc, eq, gt, isNotNull, isNull, lt, lte, notExists } from "drizzle-orm";
import type { OAuthGrantView } from "../contract.js";
import { accessTokens, oauthAuthorizationCodes, oauthClients, oauthGrants, type OAuthClientRow, type OAuthTokenEndpointAuthMethod } from "../schema.js";
import { getMcpAccessOptions } from "./options.js";
import { isPkceVerifierValid } from "./pkce.js";
import { ACCESS_TOKEN_PREFIX, createSecret, hashAccessToken, type McpAccessContext } from "./tokens.js";

/** Refresh tokens: for people and secret scanners, like the access token prefix. */
export const REFRESH_TOKEN_PREFIX = "sftmcr_";
/** Authorization codes. */
export const CONSENT_CODE_PREFIX = "sftmca_";
/** Client secrets of confidential clients. */
export const CLIENT_SECRET_PREFIX = "sftmcs_";
/** Client ids are public (RFC 6749 §2.2); the prefix only helps a person reading a log. */
const CLIENT_ID_PREFIX = "sftmc_";

/** Codes, refresh tokens and client secrets longer than this are not looked up. */
const MAX_SECRET_LENGTH = 512;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** A registration without any grant after a day is abandoned (registration is public and free). */
export const STALE_CLIENT_MS = DAY_MS;

type Transaction = Parameters<Parameters<McpAccessContext["db"]["transaction"]>[0]>[0];

export interface OAuthClientRegistration {
  /** 1 to 60 characters, trimmed, no control characters (`parseClientRegistration` makes it so). */
  readonly clientName: string;
  readonly redirectUris: readonly string[];
  readonly tokenEndpointAuthMethod: OAuthTokenEndpointAuthMethod;
}

export interface RegisteredOAuthClient {
  readonly client: OAuthClientRow;
  /** The plaintext secret of a confidential client, shown once; null for a public client. */
  readonly clientSecret: string | null;
}

export interface IssuedOAuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Seconds, as `expires_in` counts them (RFC 6749 §5.1). */
  readonly expiresIn: number;
  readonly canWrite: boolean;
}

/**
 * Registers a client (RFC 7591). A secret only for the methods that use one. Abandoned clients
 * (no grant, older than a day) are deleted first, so a flood of registrations does not pile up.
 */
export async function registerOAuthClient(ctx: McpAccessContext, input: OAuthClientRegistration): Promise<RegisteredOAuthClient> {
  const now = ctx.clock.now();
  await deleteStaleClients(ctx, now);
  const secret = input.tokenEndpointAuthMethod === "none" ? null : createSecret(CLIENT_SECRET_PREFIX);
  const [client] = await ctx.db
    .insert(oauthClients)
    .values({
      clientId: `${CLIENT_ID_PREFIX}${createSecret("").secret.slice(0, 22)}`,
      clientName: input.clientName,
      redirectUris: [...input.redirectUris],
      tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
      clientSecretHash: secret?.secretHash ?? null,
      createdAt: now,
    })
    .returning();
  if (client === undefined) throw new Error("@softure-ai/mcp-access: inserting an OAuth client returned no row");
  return { client, clientSecret: secret?.secret ?? null };
}

export async function findOAuthClient(ctx: McpAccessContext, clientId: string): Promise<OAuthClientRow | null> {
  if (clientId === "" || clientId.length > 255) return null;
  const [client] = await ctx.db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId));
  return client ?? null;
}

/**
 * Whether the client authenticated: a confidential client with its secret (constant-time
 * compare), a public client by presenting none.
 */
export function isClientSecretValid(client: OAuthClientRow, secret: string | null): boolean {
  if (client.clientSecretHash === null) return secret === null;
  if (secret === null || secret.length > MAX_SECRET_LENGTH) return false;
  const expected = Buffer.from(client.clientSecretHash);
  const actual = Buffer.from(hashAccessToken(secret));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export interface CreateAuthorizationCodeInput {
  /** The client's row id (`OAuthClientRow.id`), not its public client id. */
  readonly clientRowId: string;
  /** The person who consented, from the session. */
  readonly userId: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
  /** Asked for by the client, allowed by the app and ticked by the person. */
  readonly canWrite: boolean;
}

/** Issues a code after the person's consent. Expired codes are deleted on the way. */
export async function createAuthorizationCode(ctx: McpAccessContext, input: CreateAuthorizationCodeInput): Promise<string> {
  const now = ctx.clock.now();
  const lifetimeMs = getMcpAccessOptions(ctx.config).oauth.authorizationCodeLifetimeMinutes * MINUTE_MS;
  const { secret: code, secretHash: codeHash } = createSecret(CONSENT_CODE_PREFIX);
  await ctx.db.delete(oauthAuthorizationCodes).where(lte(oauthAuthorizationCodes.expiresAt, now));
  await ctx.db.insert(oauthAuthorizationCodes).values({
    codeHash,
    clientId: input.clientRowId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    canWrite: input.canWrite,
    expiresAt: new Date(now.getTime() + lifetimeMs),
    createdAt: now,
  });
  return code;
}

export interface ExchangeAuthorizationCodeInput {
  readonly code: string;
  /** The authenticated client. */
  readonly client: OAuthClientRow;
  /** Null when the client left it out; allowed only when it registered exactly one. */
  readonly redirectUri: string | null;
  readonly codeVerifier: string;
}

/**
 * Exchanges a code for tokens (RFC 6749 §4.1.3, PKCE per RFC 7636 §4.6), or null for any refusal.
 *
 * The code is burned first, by a conditional `UPDATE … WHERE used_at IS NULL`: a wrong verifier,
 * another client or another redirect URI leave a dead code, not an invitation to keep guessing,
 * and two parallel exchanges cannot both win. A second use of a used code revokes the grant
 * issued from it (RFC 6749 §4.1.2): two parties saw the code. A new consent of the same client
 * replaces its grant, whose tokens go by cascade.
 */
export async function exchangeAuthorizationCode(ctx: McpAccessContext, input: ExchangeAuthorizationCodeInput): Promise<IssuedOAuthTokens | null> {
  if (input.code.length > MAX_SECRET_LENGTH) return null;
  const now = ctx.clock.now();
  const codeHash = hashAccessToken(input.code);
  return ctx.db.transaction(async (tx): Promise<IssuedOAuthTokens | null> => {
    const [code] = await tx
      .update(oauthAuthorizationCodes)
      .set({ usedAt: now })
      .where(and(eq(oauthAuthorizationCodes.codeHash, codeHash), isNull(oauthAuthorizationCodes.usedAt), gt(oauthAuthorizationCodes.expiresAt, now)))
      .returning();
    if (code === undefined) {
      await revokeGrantOfReusedCode(tx, codeHash);
      return null;
    }

    const redirectUri = input.redirectUri ?? (input.client.redirectUris.length === 1 ? (input.client.redirectUris[0] ?? null) : null);
    if (code.clientId !== input.client.id || code.redirectUri !== redirectUri || !isPkceVerifierValid(input.codeVerifier, code.codeChallenge)) {
      return null;
    }

    await tx.delete(oauthGrants).where(and(eq(oauthGrants.userId, code.userId), eq(oauthGrants.clientId, code.clientId)));
    const { secret: refreshToken, secretHash: refreshTokenHash } = createSecret(REFRESH_TOKEN_PREFIX);
    const [grant] = await tx
      .insert(oauthGrants)
      .values({
        userId: code.userId,
        clientId: code.clientId,
        canWrite: code.canWrite,
        refreshTokenHash,
        refreshExpiresAt: getRefreshExpiry(ctx, now),
        createdAt: now,
      })
      .returning();
    if (grant === undefined) throw new Error("@softure-ai/mcp-access: inserting an OAuth grant returned no row");
    return issueGrantTokens(ctx, tx, { grant, clientName: input.client.clientName, refreshToken, now });
  });
}

export interface RefreshOAuthGrantInput {
  readonly refreshToken: string;
  /** The authenticated client: a grant answers only the client it was issued to. */
  readonly client: OAuthClientRow;
}

/**
 * Refreshes a grant: a new access token and a new refresh token (rotation, OAuth 2.1 §4.3.1). The
 * presented hash moves to `previous_refresh_token_hash` in the same conditional `UPDATE` that
 * checks it is current; presenting it again later deletes the whole grant, for both parties.
 */
export async function refreshOAuthGrant(ctx: McpAccessContext, input: RefreshOAuthGrantInput): Promise<IssuedOAuthTokens | null> {
  if (input.refreshToken.length > MAX_SECRET_LENGTH) return null;
  const now = ctx.clock.now();
  const presentedHash = hashAccessToken(input.refreshToken);
  return ctx.db.transaction(async (tx): Promise<IssuedOAuthTokens | null> => {
    const { secret: refreshToken, secretHash: refreshTokenHash } = createSecret(REFRESH_TOKEN_PREFIX);
    const [grant] = await tx
      .update(oauthGrants)
      .set({ refreshTokenHash, previousRefreshTokenHash: presentedHash, refreshExpiresAt: getRefreshExpiry(ctx, now) })
      .where(and(eq(oauthGrants.refreshTokenHash, presentedHash), eq(oauthGrants.clientId, input.client.id), gt(oauthGrants.refreshExpiresAt, now)))
      .returning();
    if (grant === undefined) {
      // A token from before a rotation: two parties hold it, so the grant goes for both.
      await tx.delete(oauthGrants).where(eq(oauthGrants.previousRefreshTokenHash, presentedHash));
      return null;
    }
    // The grant's spent access tokens; the current ones stay valid until they expire.
    await tx.delete(accessTokens).where(and(eq(accessTokens.grantId, grant.id), lte(accessTokens.expiresAt, now)));
    return issueGrantTokens(ctx, tx, { grant, clientName: input.client.clientName, refreshToken, now });
  });
}

function getRefreshExpiry(ctx: McpAccessContext, now: Date): Date {
  return new Date(now.getTime() + getMcpAccessOptions(ctx.config).oauth.refreshTokenLifetimeDays * DAY_MS);
}

/** The grant's access token, a row of `access_tokens` named after the client. */
async function issueGrantTokens(
  ctx: McpAccessContext,
  tx: Transaction,
  input: { readonly grant: { readonly id: string; readonly userId: string; readonly canWrite: boolean }; readonly clientName: string; readonly refreshToken: string; readonly now: Date },
): Promise<IssuedOAuthTokens> {
  const lifetimeMs = getMcpAccessOptions(ctx.config).oauth.accessTokenLifetimeMinutes * MINUTE_MS;
  const { secret: accessToken, secretHash: tokenHash } = createSecret(ACCESS_TOKEN_PREFIX);
  await tx.insert(accessTokens).values({
    userId: input.grant.userId,
    grantId: input.grant.id,
    name: input.clientName,
    tokenHash,
    canWrite: input.grant.canWrite,
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + lifetimeMs),
  });
  return { accessToken, refreshToken: input.refreshToken, expiresIn: lifetimeMs / 1000, canWrite: input.grant.canWrite };
}

/** A used code presented again revokes the grant its first use produced (same account and client). */
async function revokeGrantOfReusedCode(tx: Transaction, codeHash: string): Promise<void> {
  const [reused] = await tx
    .select({ userId: oauthAuthorizationCodes.userId, clientId: oauthAuthorizationCodes.clientId })
    .from(oauthAuthorizationCodes)
    .where(and(eq(oauthAuthorizationCodes.codeHash, codeHash), isNotNull(oauthAuthorizationCodes.usedAt)));
  if (reused === undefined) return;
  await tx.delete(oauthGrants).where(and(eq(oauthGrants.userId, reused.userId), eq(oauthGrants.clientId, reused.clientId)));
}

/** The owner's unexpired grants, newest first: the connected apps list. */
export async function listOAuthGrants(ctx: McpAccessContext, userId: string): Promise<OAuthGrantView[]> {
  return ctx.db
    .select({
      id: oauthGrants.id,
      clientName: oauthClients.clientName,
      canWrite: oauthGrants.canWrite,
      createdAt: oauthGrants.createdAt,
      lastUsedAt: oauthGrants.lastUsedAt,
    })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthGrants.clientId, oauthClients.id))
    .where(and(eq(oauthGrants.userId, userId), gt(oauthGrants.refreshExpiresAt, ctx.clock.now())))
    .orderBy(desc(oauthGrants.createdAt), desc(oauthGrants.id));
}

export interface RevokeOAuthGrantInput {
  /** The owner, from the session. */
  readonly userId: string;
  /** From the form: any value, including another account's grant id. */
  readonly grantId: string;
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Revokes a grant at once: its refresh token goes with the row and its access tokens by cascade,
 * so the assistant's next request gets 401. The owner is part of the `WHERE`.
 */
export async function revokeOAuthGrant(ctx: McpAccessContext, input: RevokeOAuthGrantInput): Promise<Ok<undefined> | Err<"mcp-access.grant_not_found">> {
  if (!UUID_SHAPE.test(input.grantId)) return err("mcp-access.grant_not_found");
  const removed = await ctx.db
    .delete(oauthGrants)
    .where(and(eq(oauthGrants.userId, input.userId), eq(oauthGrants.id, input.grantId)))
    .returning();
  return removed.length > 0 ? ok() : err("mcp-access.grant_not_found");
}

export interface PrunedOAuthRecords {
  readonly codes: number;
  readonly grants: number;
  readonly clients: number;
}

/**
 * Deletes expired codes, grants whose refresh token expired (their access tokens by cascade) and
 * abandoned clients, of every account: for a scheduled job, next to `pruneAccessTokens`.
 */
export async function pruneOAuthRecords(ctx: McpAccessContext): Promise<PrunedOAuthRecords> {
  const now = ctx.clock.now();
  const codes = await ctx.db.delete(oauthAuthorizationCodes).where(lte(oauthAuthorizationCodes.expiresAt, now)).returning();
  const grants = await ctx.db.delete(oauthGrants).where(lte(oauthGrants.refreshExpiresAt, now)).returning();
  const clients = await deleteStaleClients(ctx, now);
  return { codes: codes.length, grants: grants.length, clients };
}

/** Clients without a grant, registered more than a day ago; they give nobody any access. */
async function deleteStaleClients(ctx: McpAccessContext, now: Date): Promise<number> {
  const removed = await ctx.db
    .delete(oauthClients)
    .where(
      and(
        lt(oauthClients.createdAt, new Date(now.getTime() - STALE_CLIENT_MS)),
        notExists(ctx.db.select({ id: oauthGrants.id }).from(oauthGrants).where(eq(oauthGrants.clientId, oauthClients.id))),
      ),
    )
    .returning();
  return removed.length;
}
