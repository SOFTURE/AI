// Registration: a new account with its first session, in one transaction with the app's
// `onRegistered` hook, so a consent the hook could not store never leaves an account behind.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit } from "@softure-ai/security/server";
import type { SignedIn } from "../contract.js";
import { users } from "../schema.js";
import { getAuthOptions } from "./options.js";
import { hashPassword } from "./password.js";
import { assertAuthBuckets, BUCKETS } from "./rate-limits.js";
import { createSession, type AuthContext } from "./sessions.js";
import { isRegistrationClosed } from "./switches.js";
import { checkNewPassword, parseEmail } from "./validation.js";

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  /** Whether the consent checkbox was ticked. */
  readonly hasConsented: boolean;
  /** The client's rate limit key (`identifyClient`). */
  readonly clientKey: string;
}

export type RegisterErrorCode =
  | "auth.registration_closed"
  | "auth.email_invalid"
  | "auth.email_taken"
  | "auth.password_too_short"
  | "auth.password_too_long"
  | "auth.consent_required";

export type RegisterResult = Ok<SignedIn> | Err<RegisterErrorCode> | RateLimitRejection;

/**
 * Creates an account and signs it in. The input is checked first (cheap, and a typo should not
 * spend the client's attempts), then the `register` bucket is counted, then the password is hashed.
 * Database errors and errors thrown by the hook propagate after the rollback.
 */
export async function registerUser(ctx: AuthContext, input: RegisterInput): Promise<RegisterResult> {
  const options = getAuthOptions(ctx.config);
  assertAuthBuckets(ctx.config);
  if (isRegistrationClosed(ctx.config)) return err("auth.registration_closed");

  const email = parseEmail(input.email);
  if (!email.ok) return email;
  const passwordPolicy = checkNewPassword(input.password, options.password.minLength);
  // A fresh error, not the check's own result: CodeQL treats that result as password data and
  // would follow it through the returned union to the session token (js/insufficient-password-hash).
  if (!passwordPolicy.ok) return err(passwordPolicy.error);
  if (options.requireConsent && !input.hasConsented) return err("auth.consent_required");

  const limit = await consumeRateLimit(ctx, { bucket: BUCKETS.register, key: input.clientKey });
  if (!limit.ok) return limit;

  const passwordHash = await hashPassword(input.password, options.password.scrypt);
  const now = ctx.clock.now();

  return ctx.db.transaction(async (tx): Promise<Ok<SignedIn> | Err<"auth.email_taken">> => {
    const txCtx: AuthContext = { ...ctx, db: tx };
    const [row] = await tx
      .insert(users)
      .values({ email: email.value, passwordHash, createdAt: now, passwordChangedAt: now })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (row === undefined) return err("auth.email_taken");
    const user = { id: row.id, email: row.email, createdAt: row.createdAt };

    await options.onRegistered?.({ user, consent: options.requireConsent ? { acceptedAt: now } : null }, txCtx);
    const session = await createSession(txCtx, user.id);
    return ok({ user, session });
  });
}
