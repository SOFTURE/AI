// Database sessions: one row per login, keyed by the sha256 of the cookie token, with a fixed expiry.
import type { ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, eq, gt, lte, ne } from "drizzle-orm";
import type { AuthUser, NewSession } from "../contract.js";
import { sessions, users } from "../schema.js";
import { getAuthOptions, getLegacyTokenPattern } from "./options.js";
import { createSessionToken, hashSessionToken, isSessionTokenShape } from "./session-token.js";

export type AuthContext = ModuleContext<Queryable>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Opens a session for `userId`; the returned token goes into the cookie. */
export async function createSession(ctx: AuthContext, userId: string): Promise<NewSession> {
  const now = ctx.clock.now();
  const expiresAt = new Date(now.getTime() + getAuthOptions(ctx.config).session.ttlDays * DAY_MS);
  const { token, tokenHash } = createSessionToken();
  await ctx.db.insert(sessions).values({ tokenHash, userId, createdAt: now, expiresAt });
  return { token, expiresAt };
}

/** The user of a live session, or null for an unknown, malformed or expired token. */
export async function findSessionUser(ctx: AuthContext, token: string): Promise<AuthUser | null> {
  if (!isSessionTokenShape(token, getLegacyTokenPattern(ctx.config))) return null;
  const [row] = await ctx.db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, ctx.clock.now())))
    .limit(1);
  return row ?? null;
}

/** Ends one session. An unknown token is already logged out, so it is not an error. */
export async function logoutSession(ctx: AuthContext, token: string): Promise<void> {
  if (!isSessionTokenShape(token, getLegacyTokenPattern(ctx.config))) return;
  await ctx.db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
}

/** Deletes every expired session; for a scheduled job. Returns how many were deleted. */
export async function pruneSessions(ctx: AuthContext): Promise<number> {
  const deleted = await ctx.db.delete(sessions).where(lte(sessions.expiresAt, ctx.clock.now())).returning();
  return deleted.length;
}

/** Deletes the expired sessions of one user (at their login, so rows do not pile up without a job). */
export async function deleteExpiredSessions(ctx: AuthContext, userId: string): Promise<void> {
  await ctx.db.delete(sessions).where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, ctx.clock.now())));
}

export interface RevokeUserSessionsOptions {
  /** A session token to keep, e.g. the one of the admin acting on their own account. */
  readonly except?: string;
}

/**
 * Ends every session of `userId` (all but `except`), e.g. after an account recovery or a suspected
 * leak; each device must log in again. Returns how many sessions were ended.
 */
export async function revokeUserSessions(ctx: AuthContext, userId: string, options: RevokeUserSessionsOptions = {}): Promise<number> {
  const kept = options.except === undefined ? undefined : ne(sessions.tokenHash, hashSessionToken(options.except));
  const deleted = await ctx.db.delete(sessions).where(and(eq(sessions.userId, userId), kept)).returning();
  return deleted.length;
}
