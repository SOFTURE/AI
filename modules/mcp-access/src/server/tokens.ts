// Access tokens (an adopting app's token code, generalised). An MCP token is `sftmcp_` and 32 random
// bytes, an API token (`api-tokens.ts`) the app's prefix and 32 random bytes; the database holds only its sha256, so a leaked row cannot be replayed. The plaintext
// leaves this file once, in the result of `issueAccessToken` (or of an OAuth exchange, `oauth.ts`).
import { createHash, randomBytes } from "node:crypto";
import { err, errorLogLabel, ok, type Err, type ModuleContext, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, count, desc, eq, gt, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { AccessTokenKind, AccessTokenView } from "../contract.js";
import { MAX_PRESENTED_TOKEN_LENGTH, MAX_TOKEN_NAME_LENGTH, type McpAccessOptions } from "../options.js";
import { accessTokens, oauthGrants } from "../schema.js";
import { getMcpAccessOptions } from "./options.js";

export type McpAccessContext = ModuleContext<Queryable>;

/** Marks a token as this module's, for people and for secret scanners. */
export const ACCESS_TOKEN_PREFIX = "sftmcp_";

const TOKEN_BYTES = 32;
/** The prefix and base64url of 32 bytes. */
const TOKEN_SHAPE = /^sftmcp_[A-Za-z0-9_-]{43}$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;
/** `last_used_at` answers "is this token still in use?"; a minute is precise enough for that. */
const LAST_USED_RESOLUTION_MS = 60_000;

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Whether a presented value has the module's token shape. */
export function isAccessTokenShape(token: string): boolean {
  return TOKEN_SHAPE.test(token);
}

/**
 * Whether a presented value is looked up at all: the module's shape, or the app's
 * `legacyTokenPattern` for tokens issued before the module. The length cap runs first, so no
 * pattern ever sees a huge header.
 */
function isAcceptedTokenShape(options: McpAccessOptions, token: string): boolean {
  if (token.length > MAX_PRESENTED_TOKEN_LENGTH) return false;
  return isAccessTokenShape(token) || (options.legacyTokenPattern?.test(token) ?? false);
}

/** A new secret with the given prefix and its hash; the plaintext is returned once, never stored. */
export function createSecret(prefix: string): { readonly secret: string; readonly secretHash: string } {
  const secret = `${prefix}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
  return { secret, secretHash: hashAccessToken(secret) };
}

export interface IssueAccessTokenInput {
  /** The auth user id of the owner, from the session. */
  readonly userId: string;
  readonly name: string;
  /** Asked for write access; granted only while the app allows writes. */
  readonly canWrite: boolean;
}

export interface IssuedAccessToken {
  readonly id: string;
  /** The plaintext: shown to the owner once, stored nowhere. */
  readonly token: string;
  readonly name: string;
  readonly canWrite: boolean;
  readonly expiresAt: Date;
}

export type IssueAccessTokenResult =
  | Ok<IssuedAccessToken>
  | Err<"mcp-access.name_required" | "mcp-access.name_too_long" | "mcp-access.token_limit_reached">;

/**
 * Issues an MCP token for its owner. The per-account limit counts unexpired tokens of both kinds, in one
 * transaction that holds a per-user advisory lock, so two parallel requests cannot both take the last
 * place. The owner's expired tokens are deleted first: they would otherwise count against the limit.
 * Database failures propagate.
 */
export async function issueAccessToken(ctx: McpAccessContext, input: IssueAccessTokenInput): Promise<IssueAccessTokenResult> {
  const options = getMcpAccessOptions(ctx.config);
  const canWrite = input.canWrite && options.allowWrites;
  const result = await insertToken(ctx, { userId: input.userId, name: input.name, kind: "mcp", canWrite, scopes: [], secret: createSecret(ACCESS_TOKEN_PREFIX) });
  if (!result.ok) return result;
  const { id, token, name, expiresAt } = result.value;
  return ok({ id, token, name, canWrite, expiresAt });
}

/** What `insertToken` stores: the new secret with its hash, write access and scopes are already decided. */
export interface TokenInsert {
  readonly userId: string;
  readonly name: string;
  readonly kind: AccessTokenKind;
  readonly canWrite: boolean;
  readonly scopes: readonly string[];
  /** The plaintext and the hash the lookup will find it by (`createSecret`, or the API token's own). */
  readonly secret: { readonly secret: string; readonly secretHash: string };
}

export type InsertTokenResult =
  | Ok<{ readonly id: string; readonly token: string; readonly name: string; readonly expiresAt: Date }>
  | Err<"mcp-access.name_required" | "mcp-access.name_too_long" | "mcp-access.token_limit_reached">;

/** Stores a new token of either kind under the owner's lock and limit; the plaintext is returned once. */
export async function insertToken(ctx: McpAccessContext, input: TokenInsert): Promise<InsertTokenResult> {
  const name = input.name.trim();
  if (name === "") return err("mcp-access.name_required");
  if (name.length > MAX_TOKEN_NAME_LENGTH) return err("mcp-access.name_too_long");

  const options = getMcpAccessOptions(ctx.config);
  const now = ctx.clock.now();
  const expiresAt = new Date(now.getTime() + options.tokenLifetimeDays * DAY_MS);

  return ctx.db.transaction(async (tx): Promise<InsertTokenResult> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`mcp-access:${input.userId}`}, 0))`);
    await tx.delete(accessTokens).where(and(eq(accessTokens.userId, input.userId), lte(accessTokens.expiresAt, now)));
    // OAuth access tokens belong to their grant and rotate every hour: they do not take places.
    const [held] = await tx
      .select({ total: count() })
      .from(accessTokens)
      .where(and(eq(accessTokens.userId, input.userId), isNull(accessTokens.grantId)));
    if ((held?.total ?? 0) >= options.maxTokensPerUser) return err("mcp-access.token_limit_reached");

    const { secret: token, secretHash: tokenHash } = input.secret;
    const [row] = await tx
      .insert(accessTokens)
      .values({ userId: input.userId, name, tokenHash, canWrite: input.canWrite, createdAt: now, expiresAt, kind: input.kind, scopes: [...input.scopes] })
      .returning();
    if (row === undefined) throw new Error("@softure-ai/mcp-access: inserting a token returned no row");
    return ok({ id: row.id, token, name, expiresAt });
  });
}

/**
 * The owner's hand-issued tokens of both kinds, newest first, expired ones included (the list marks
 * them). OAuth access tokens are left out: the page shows their grants instead.
 */
export async function listAccessTokens(ctx: McpAccessContext, userId: string): Promise<AccessTokenView[]> {
  return ctx.db
    .select({
      id: accessTokens.id,
      name: accessTokens.name,
      kind: accessTokens.kind,
      scopes: accessTokens.scopes,
      canWrite: accessTokens.canWrite,
      createdAt: accessTokens.createdAt,
      expiresAt: accessTokens.expiresAt,
      lastUsedAt: accessTokens.lastUsedAt,
    })
    .from(accessTokens)
    .where(and(eq(accessTokens.userId, userId), isNull(accessTokens.grantId)))
    .orderBy(desc(accessTokens.createdAt), desc(accessTokens.id));
}

export interface RevokeAccessTokenInput {
  /** The owner, from the session. */
  readonly userId: string;
  /** From the form: any value, including another account's token id. */
  readonly tokenId: string;
}

/**
 * Deletes a hand-issued token at once; the next request with it gets 401. The owner is part of the
 * `WHERE`, so another account's id matches no row instead of relying on a comparison here. An
 * OAuth access token is revoked with its grant (`revokeOAuthGrant`).
 */
export async function revokeAccessToken(
  ctx: McpAccessContext,
  input: RevokeAccessTokenInput,
): Promise<Ok<undefined> | Err<"mcp-access.token_not_found">> {
  if (!UUID_SHAPE.test(input.tokenId)) return err("mcp-access.token_not_found");
  const removed = await ctx.db
    .delete(accessTokens)
    .where(and(eq(accessTokens.userId, input.userId), eq(accessTokens.id, input.tokenId), isNull(accessTokens.grantId)))
    .returning();
  return removed.length > 0 ? ok() : err("mcp-access.token_not_found");
}

/** The identity behind a valid token. */
export interface VerifiedAccessToken {
  readonly tokenId: string;
  readonly userId: string;
  /** Effective write access: the token was issued for writes and the app allows them now. */
  readonly canWrite: boolean;
  readonly expiresAt: Date;
  /** The OAuth grant the token was issued from; null for a hand-issued token. */
  readonly grantId: string | null;
}

/**
 * A token's name, the client it was issued for ("Laptop", an OAuth client's name), for a record of tool calls:
 * `null` for an id that is not a stored token's (the stdio id, a pruned or unknown token).
 */
export async function findTokenClientName(ctx: McpAccessContext, tokenId: string): Promise<string | null> {
  if (!UUID_SHAPE.test(tokenId)) return null;
  const [row] = await ctx.db.select({ name: accessTokens.name }).from(accessTokens).where(eq(accessTokens.id, tokenId));
  return row?.name ?? null;
}

/**
 * The identity behind an MCP token, or null for anything unknown, revoked or expired, and for an API
 * token: the caller cannot tell which, so a guess learns nothing. The expiry sits in the query, so no
 * code path can forget it. Records the use (at most once a minute per token); a failed record is
 * logged and does not fail the request. Database failures of the lookup propagate.
 */
export async function verifyAccessToken(ctx: McpAccessContext, token: string): Promise<VerifiedAccessToken | null> {
  const options = getMcpAccessOptions(ctx.config);
  if (!isAcceptedTokenShape(options, token)) return null;
  const row = await findValidToken(ctx, hashAccessToken(token), "mcp");
  if (row === null) return null;
  return {
    tokenId: row.id,
    userId: row.userId,
    canWrite: row.canWrite && options.allowWrites,
    expiresAt: row.expiresAt,
    grantId: row.grantId,
  };
}

/** A stored, unexpired token of one kind, found by the hash of its plaintext. */
export interface ValidTokenRow {
  readonly id: string;
  readonly userId: string;
  readonly canWrite: boolean;
  readonly expiresAt: Date;
  readonly grantId: string | null;
  readonly scopes: readonly string[];
}

/**
 * The unexpired token of `kind` stored under this hash, or null, after recording its use. The caller
 * checks the shape first, so no lookup runs for a value that cannot be a token.
 */
export async function findValidToken(ctx: McpAccessContext, tokenHash: string, kind: AccessTokenKind): Promise<ValidTokenRow | null> {
  const now = ctx.clock.now();
  const [row] = await ctx.db
    .select({
      id: accessTokens.id,
      userId: accessTokens.userId,
      canWrite: accessTokens.canWrite,
      expiresAt: accessTokens.expiresAt,
      grantId: accessTokens.grantId,
      scopes: accessTokens.scopes,
    })
    .from(accessTokens)
    .where(and(eq(accessTokens.tokenHash, tokenHash), eq(accessTokens.kind, kind), gt(accessTokens.expiresAt, now)));
  if (row === undefined) return null;
  await recordUse(ctx, row, now);
  return row;
}

/** Records the use on the token and, for an OAuth token, on its grant (the connected apps list). */
async function recordUse(ctx: McpAccessContext, token: { readonly id: string; readonly grantId: string | null }, now: Date): Promise<void> {
  const staleBefore = new Date(now.getTime() - LAST_USED_RESOLUTION_MS);
  try {
    await ctx.db
      .update(accessTokens)
      .set({ lastUsedAt: now })
      .where(and(eq(accessTokens.id, token.id), or(isNull(accessTokens.lastUsedAt), lt(accessTokens.lastUsedAt, staleBefore))));
    if (token.grantId !== null) {
      await ctx.db
        .update(oauthGrants)
        .set({ lastUsedAt: now })
        .where(and(eq(oauthGrants.id, token.grantId), or(isNull(oauthGrants.lastUsedAt), lt(oauthGrants.lastUsedAt, staleBefore))));
    }
  } catch (error) {
    // The token id is not a secret; the token is never logged.
    console.error(`@softure-ai/mcp-access: recording the use of token ${token.id} failed: ${errorLogLabel(error)}`);
  }
}

/**
 * Deletes every expired token, of every account and kind, hand-issued and OAuth alike. Issuing already
 * removes the issuer's own; an app may call this from a scheduled job so abandoned accounts do not
 * keep dead rows (with `pruneOAuthRecords` for codes, grants and clients).
 */
export async function pruneAccessTokens(ctx: McpAccessContext): Promise<number> {
  const removed = await ctx.db
    .delete(accessTokens)
    .where(lte(accessTokens.expiresAt, ctx.clock.now()))
    .returning();
  return removed.length;
}
