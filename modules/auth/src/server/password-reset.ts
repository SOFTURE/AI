// Password reset by token. A request counts its buckets and answers the same for every email;
// `deliverPasswordReset` then issues the token and calls the app's sender (the Next adapter runs it
// after the response, so neither its timing nor its failures reveal an account). A reset link
// carries 32 random bytes; only their sha256 is stored, one pending link per account, and the reset
// deletes the row in the transaction that sets the new password and ends every session.
import { err, ok, type Err, type Ok, type SoftureConfig } from "@softure-ai/core";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit } from "@softure-ai/security/server";
import { and, eq, gt, lte } from "drizzle-orm";
import type { AuthUser } from "../contract.js";
import { passwordResets, sessions, users } from "../schema.js";
import { getAuthOptions, getAuthRoutes } from "./options.js";
import { hashPassword } from "./password.js";
import { assertAuthBuckets, BUCKETS, emailSubjectKey } from "./rate-limits.js";
import type { AuthContext } from "./sessions.js";
// Reset tokens have the shape of session tokens: the same generator, hash and shape check.
import { createSessionToken, hashSessionToken, isSessionTokenShape } from "./session-token.js";
import { checkNewPassword, parseEmail } from "./validation.js";

const MINUTE_MS = 60 * 1000;
/** The query parameter of the reset link that carries the token. */
export const RESET_TOKEN_PARAM = "token";

/** Whether the app passed a sender, i.e. whether password reset is offered at all. */
export function isPasswordResetEnabled(config: SoftureConfig): boolean {
  return getAuthOptions(config).passwordReset.send !== undefined;
}

export interface PasswordResetRequestInput {
  readonly email: string;
  /** The client's rate limit key (`identifyClient`). */
  readonly clientKey: string;
}

export type PasswordResetRequestResult =
  | Ok<{ readonly email: string }>
  | Err<"auth.password_reset_unavailable" | "auth.email_invalid">
  | RateLimitRejection;

/**
 * Accepts a reset request: counts `password-reset` per client, checks the email's shape and counts
 * `password-reset-account` per email. It never looks the account up, so its answer is the same for
 * every email; pass the returned email to `deliverPasswordReset`. Database errors propagate.
 */
export async function requestPasswordReset(ctx: AuthContext, input: PasswordResetRequestInput): Promise<PasswordResetRequestResult> {
  assertAuthBuckets(ctx.config);
  if (!isPasswordResetEnabled(ctx.config)) return err("auth.password_reset_unavailable");
  const byClient = await consumeRateLimit(ctx, { bucket: BUCKETS.passwordReset, key: input.clientKey });
  if (!byClient.ok) return byClient;

  const email = parseEmail(input.email);
  if (!email.ok) return email;
  const byAccount = await consumeRateLimit(ctx, { bucket: BUCKETS.passwordResetAccount, key: emailSubjectKey(email.value) });
  if (!byAccount.ok) return byAccount;
  return ok({ email: email.value });
}

/**
 * Issues a reset link for the account with `email` (replacing a pending one) and hands it to the
 * app's sender. `no_account` when no account has that email. Sender and database errors propagate.
 */
export async function deliverPasswordReset(ctx: AuthContext, email: string): Promise<"sent" | "no_account"> {
  const send = getAuthOptions(ctx.config).passwordReset.send;
  if (send === undefined) {
    throw new Error("@softure-ai/auth: deliverPasswordReset needs auth({ passwordReset: { send } })");
  }
  const [user] = await ctx.db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (user === undefined) return "no_account";

  const { token, expiresAt } = await issuePasswordReset(ctx, user.id);
  await send(getPasswordResetLink(ctx.config, token), user, { expiresAt, locale: ctx.config.locale });
  return "sent";
}

/** Stores a new reset token for `userId`, replacing a pending one, and returns the token. */
export async function issuePasswordReset(ctx: AuthContext, userId: string): Promise<{ readonly token: string; readonly expiresAt: Date }> {
  const now = ctx.clock.now();
  const expiresAt = new Date(now.getTime() + getAuthOptions(ctx.config).passwordReset.ttlMinutes * MINUTE_MS);
  const { token, tokenHash } = createSessionToken();
  await ctx.db
    .insert(passwordResets)
    .values({ userId, tokenHash, createdAt: now, expiresAt })
    .onConflictDoUpdate({ target: passwordResets.userId, set: { tokenHash, createdAt: now, expiresAt } });
  return { token, expiresAt };
}

/** The link the sender delivers: the reset route on `appOrigin`, with the token in the query. */
export function getPasswordResetLink(config: SoftureConfig, token: string): string {
  const link = new URL(getAuthRoutes(config).resetPassword, config.appOrigin);
  link.searchParams.set(RESET_TOKEN_PARAM, token);
  return link.href;
}

/** The account a live reset token belongs to, or null for an unknown, malformed, used or expired one. Reads only. */
export async function findPasswordResetUser(ctx: AuthContext, token: string): Promise<AuthUser | null> {
  if (!isSessionTokenShape(token)) return null;
  const [row] = await ctx.db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(and(eq(passwordResets.tokenHash, hashSessionToken(token)), gt(passwordResets.expiresAt, ctx.clock.now())))
    .limit(1);
  return row ?? null;
}

export interface ResetPasswordInput {
  readonly token: string;
  readonly newPassword: string;
  /** The client's rate limit key (`identifyClient`). */
  readonly clientKey: string;
}

export type ResetPasswordErrorCode =
  | "auth.password_reset_unavailable"
  | "auth.reset_token_invalid"
  | "auth.password_too_short"
  | "auth.password_too_long";

export type ResetPasswordResult = Ok<undefined> | Err<ResetPasswordErrorCode> | RateLimitRejection;

/**
 * Sets a new password with a reset token. Counts `password-reset-confirm` per client first. The
 * token is consumed by a conditional delete in the transaction that stores the new hash and ends
 * every session of the account, so it works once even when two submissions race. Database errors
 * propagate.
 */
export async function resetPassword(ctx: AuthContext, input: ResetPasswordInput): Promise<ResetPasswordResult> {
  const options = getAuthOptions(ctx.config);
  assertAuthBuckets(ctx.config);
  if (!isPasswordResetEnabled(ctx.config)) return err("auth.password_reset_unavailable");
  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.passwordResetConfirm, key: input.clientKey });
  if (!limit.ok) return limit;

  const user = await findPasswordResetUser(ctx, input.token);
  if (user === null) return err("auth.reset_token_invalid");
  const policy = checkNewPassword(input.newPassword, options.password.minLength);
  // A fresh error, not the check's own result: CodeQL treats that result as password data
  // (js/insufficient-password-hash), as in registerUser.
  if (!policy.ok) return err(policy.error);

  const passwordHash = await hashPassword(input.newPassword, options.password.scrypt);
  const tokenHash = hashSessionToken(input.token);
  return ctx.db.transaction(async (tx): Promise<ResetPasswordResult> => {
    const now = ctx.clock.now();
    const [consumed] = await tx
      .delete(passwordResets)
      .where(and(eq(passwordResets.tokenHash, tokenHash), gt(passwordResets.expiresAt, now)))
      .returning();
    if (consumed === undefined) return err("auth.reset_token_invalid");
    await tx.update(users).set({ passwordHash, passwordChangedAt: now }).where(eq(users.id, consumed.userId));
    await tx.delete(sessions).where(eq(sessions.userId, consumed.userId));
    return ok();
  });
}

/** Deletes every expired reset; for a scheduled job. Returns how many were deleted. */
export async function prunePasswordResets(ctx: AuthContext): Promise<number> {
  const deleted = await ctx.db.delete(passwordResets).where(lte(passwordResets.expiresAt, ctx.clock.now())).returning();
  return deleted.length;
}
