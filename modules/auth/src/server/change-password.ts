// Password change for a signed-in user. The new password must differ from the current one. The new hash, the end of every other session of the user
// and of a pending reset link happen in one transaction; the session that made the change stays signed in.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit } from "@softure-ai/security/server";
import { and, eq, ne } from "drizzle-orm";
import { passwordResets, sessions, users } from "../schema.js";
import { getAuthOptions } from "./options.js";
import { hashPassword, verifyPassword } from "./password.js";
import { assertAuthBuckets, BUCKETS, userSubjectKey } from "./rate-limits.js";
import { findSessionUser, type AuthContext } from "./sessions.js";
import { hashSessionToken } from "./session-token.js";
import { checkNewPassword } from "./validation.js";

export interface ChangePasswordInput {
  /** The token of the session making the change; it stays valid. */
  readonly sessionToken: string;
  readonly currentPassword: string;
  readonly newPassword: string;
}

export type ChangePasswordErrorCode =
  | "auth.unauthenticated"
  | "auth.current_password_invalid"
  | "auth.password_unchanged"
  | "auth.password_too_short"
  | "auth.password_too_long";

export type ChangePasswordResult = Ok<undefined> | Err<ChangePasswordErrorCode> | RateLimitRejection;

/** Changes the password of the session's user and ends their other sessions. Database errors propagate. */
export async function changePassword(ctx: AuthContext, input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const options = getAuthOptions(ctx.config);
  assertAuthBuckets(ctx.config);
  const user = await findSessionUser(ctx, input.sessionToken);
  if (user === null) return err("auth.unauthenticated");

  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.changePassword, key: userSubjectKey(user.id) });
  if (!limit.ok) return limit;

  const policy = checkNewPassword(input.newPassword, options.password.minLength);
  if (!policy.ok) return policy;

  const [stored] = await ctx.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (stored === undefined) return err("auth.unauthenticated");
  if (!(await verifyPassword(input.currentPassword, stored.passwordHash))) return err("auth.current_password_invalid");
  // Compared in NFC, as the hash is: another Unicode form of the same password is the same password.
  if (input.newPassword.normalize("NFC") === input.currentPassword.normalize("NFC")) return err("auth.password_unchanged");

  const passwordHash = await hashPassword(input.newPassword, options.password.scrypt);
  return ctx.db.transaction(async (tx): Promise<ChangePasswordResult> => {
    // Conditional on the hash just verified: two parallel changes cannot both win.
    const updated = await tx
      .update(users)
      .set({ passwordHash, passwordChangedAt: ctx.clock.now() })
      .where(and(eq(users.id, user.id), eq(users.passwordHash, stored.passwordHash)))
      .returning();
    if (updated.length === 0) return err("auth.current_password_invalid");
    await tx.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, hashSessionToken(input.sessionToken))));
    // A reset link requested before the change must not outlive it.
    await tx.delete(passwordResets).where(eq(passwordResets.userId, user.id));
    return ok();
  });
}
