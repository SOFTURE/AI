// Re-authentication before an action that cannot be undone, such as deleting the account: the
// signed-in user types their password again, or signs in with their provider again, so a session
// cookie alone is not enough.
import { and, eq, gt, gte } from "drizzle-orm";
import { identities, sessions, users } from "../schema.js";
import { verifyPassword } from "./password.js";
import { hashSessionToken, isSessionTokenShape } from "./session-token.js";
import { getLegacyTokenPattern } from "./options.js";
import type { AuthContext } from "./sessions.js";

/**
 * Whether `password` is the current password of the account. False for an unknown account. The
 * caller counts the attempt in a rate limit bucket first: this is a password check like a login.
 */
export async function isCurrentPassword(ctx: AuthContext, userId: string, password: string): Promise<boolean> {
  const [stored] = await ctx.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (stored === undefined) return false;
  return verifyPassword(password, stored.passwordHash);
}

/** The ids of the providers the account signs in with (its `auth.identities`), sorted. */
export async function findLinkedProviders(ctx: AuthContext, userId: string): Promise<readonly string[]> {
  const rows = await ctx.db.select({ provider: identities.provider }).from(identities).where(eq(identities.userId, userId));
  return rows.map((row) => row.provider).sort();
}

/** How long after a provider's sign-in its session may still be opened (the callback opens it right after). */
const SIGN_IN_TO_SESSION_MS = 60 * 1000;

export interface RecentProviderSignInInput {
  /** The signed-in user, from the session. */
  readonly userId: string;
  /** The request's session token: only the session this sign-in opened counts. */
  readonly sessionToken: string;
  /** How recent the sign-in must be, in minutes. */
  readonly withinMinutes: number;
}

/**
 * The provider whose sign-in opened this very session within the last `withinMinutes`, or null:
 * an account without a password it knows (one created by a provider) re-authenticates by signing in
 * with its provider again. A session opened by a password login, an older session, another user's
 * session or an expired one is null; so is a provider sign-in that opened a session elsewhere.
 */
export async function findRecentProviderSignIn(ctx: AuthContext, input: RecentProviderSignInInput): Promise<string | null> {
  if (!isSessionTokenShape(input.sessionToken, getLegacyTokenPattern(ctx.config))) return null;
  const now = ctx.clock.now();
  const since = new Date(now.getTime() - input.withinMinutes * 60 * 1000);
  const [session] = await ctx.db
    .select({ createdAt: sessions.createdAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(input.sessionToken)),
        eq(sessions.userId, input.userId),
        gt(sessions.expiresAt, now),
        gte(sessions.createdAt, since),
      ),
    )
    .limit(1);
  if (session === undefined) return null;
  const linked = await ctx.db
    .select({ provider: identities.provider, lastLoginAt: identities.lastLoginAt })
    .from(identities)
    .where(and(eq(identities.userId, input.userId), gte(identities.lastLoginAt, since)));
  const opened = session.createdAt.getTime();
  // The callback stamps the identity, then opens the session: the session is the sign-in's own when it follows the stamp closely.
  const match = linked.find((row) => row.lastLoginAt.getTime() <= opened && opened - row.lastLoginAt.getTime() <= SIGN_IN_TO_SESSION_MS);
  return match?.provider ?? null;
}
