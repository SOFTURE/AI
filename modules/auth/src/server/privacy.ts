// The auth part of a GDPR export and deletion (`@softure-ai/privacy`): the account (with its display name), its roles, its
// sessions, a pending reset link and its OpenID Connect identities. Secrets never leave: no password hash and no token hash.
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, eq } from "drizzle-orm";
import { identities, passwordResets, sessions, userRoles, users } from "../schema.js";

/** What auth holds about one user, as it appears in their export. */
export interface AuthUserData {
  /** Null when no account has this id. */
  readonly account: {
    readonly id: string;
    readonly email: string;
    readonly createdAt: Date;
    readonly passwordChangedAt: Date;
    /** The name the OpenID Connect provider sent; null when none did. */
    readonly displayName: string | null;
  } | null;
  /** Stored roles; a role held through `adminEmails` is configuration, not stored data. */
  readonly roles: readonly { readonly role: string; readonly grantedAt: Date }[];
  readonly sessions: readonly { readonly createdAt: Date; readonly expiresAt: Date }[];
  readonly passwordReset: { readonly createdAt: Date; readonly expiresAt: Date } | null;
  /** The provider identities that sign in to the account. */
  readonly identities: readonly {
    readonly provider: string;
    readonly subject: string;
    readonly email: string;
    readonly createdAt: Date;
    readonly lastLoginAt: Date;
  }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_DATA: AuthUserData = { account: null, roles: [], sessions: [], passwordReset: null, identities: [] };

/** The user's auth data. An id that is not a UUID cannot be an account, so it has none. */
export async function exportAuthUserData(context: ModuleContext, userId: string): Promise<Ok<AuthUserData>> {
  if (!UUID.test(userId)) return ok(NO_DATA);
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const [account] = await db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt, passwordChangedAt: users.passwordChangedAt, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId));
  const roles = await db
    .select({ role: userRoles.role, grantedAt: userRoles.grantedAt })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(userRoles.role));
  const userSessions = await db
    .select({ createdAt: sessions.createdAt, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(asc(sessions.createdAt));
  const [passwordReset] = await db
    .select({ createdAt: passwordResets.createdAt, expiresAt: passwordResets.expiresAt })
    .from(passwordResets)
    .where(eq(passwordResets.userId, userId));
  const userIdentities = await db
    .select({
      provider: identities.provider,
      subject: identities.subject,
      email: identities.email,
      createdAt: identities.createdAt,
      lastLoginAt: identities.lastLoginAt,
    })
    .from(identities)
    .where(eq(identities.userId, userId))
    .orderBy(asc(identities.provider));
  return ok({ account: account ?? null, roles, sessions: userSessions, passwordReset: passwordReset ?? null, identities: userIdentities });
}

/**
 * Deletes the account and everything auth keeps for it. The child rows go first, by name, so the
 * deletion does not depend on the cascades alone; every session ends with them.
 */
export async function deleteAuthUserData(context: ModuleContext, userId: string): Promise<Ok<undefined>> {
  if (!UUID.test(userId)) return ok();
  const db = context.db as Queryable;
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(passwordResets).where(eq(passwordResets.userId, userId));
  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  await db.delete(identities).where(eq(identities.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  return ok();
}

export const authPrivacyContributor: PrivacyContributor = {
  exportUserData: exportAuthUserData,
  deleteUserData: deleteAuthUserData,
};
