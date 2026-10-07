// Login. Both buckets are counted before anything else: `login` per client address stops a flood,
// `login-account` per email stops a distributed attack on one account. An unknown email takes as
// long as a wrong password (a dummy verification) and fails with the same code.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { RateLimitRejection } from "@softure-ai/security";
import { consumeRateLimit, resetRateLimit } from "@softure-ai/security/server";
import { and, eq } from "drizzle-orm";
import type { SignedIn } from "../contract.js";
import { users } from "../schema.js";
import { getAuthOptions } from "./options.js";
import { hashPassword, matchPassword, MAX_PASSWORD_LENGTH, needsRehash, verifyDummyPassword } from "./password.js";
import { assertAuthBuckets, BUCKETS, emailSubjectKey } from "./rate-limits.js";
import { createSession, deleteExpiredSessions, type AuthContext } from "./sessions.js";
import { getPasswordLength, normalizeEmail } from "./validation.js";

export interface LoginInput {
  readonly email: string;
  readonly password: string;
  /** The client's rate limit key (`identifyClient`). */
  readonly clientKey: string;
}

export type LoginResult = Ok<SignedIn> | Err<"auth.invalid_credentials"> | RateLimitRejection;

/** Checks the credentials and opens a session. Database errors propagate. */
export async function loginUser(ctx: AuthContext, input: LoginInput): Promise<LoginResult> {
  const options = getAuthOptions(ctx.config);
  assertAuthBuckets(ctx.config);
  const byClient = await consumeRateLimit(ctx, { bucket: BUCKETS.login, key: input.clientKey });
  if (!byClient.ok) return byClient;

  const email = normalizeEmail(input.email);
  if (email === "" || input.password === "" || getPasswordLength(input.password) > MAX_PASSWORD_LENGTH) {
    return err("auth.invalid_credentials");
  }
  const accountKey = emailSubjectKey(email);
  const byAccount = await consumeRateLimit(ctx, { bucket: BUCKETS.loginAccount, key: accountKey });
  if (!byAccount.ok) return byAccount;

  const [user] = await ctx.db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user === undefined) {
    await verifyDummyPassword(input.password, options.password.scrypt);
    return err("auth.invalid_credentials");
  }
  const match = await matchPassword(input.password, user.passwordHash);
  if (match === "mismatch") return err("auth.invalid_credentials");

  await resetRateLimit(ctx, { bucket: BUCKETS.loginAccount, key: accountKey });
  await deleteExpiredSessions(ctx, user.id);
  // A legacy match (raw, non-NFC input) is rehashed too, so the stored hash is of the NFC form.
  if (match === "legacy" || needsRehash(user.passwordHash, options.password.scrypt)) {
    const passwordHash = await hashPassword(input.password, options.password.scrypt);
    // Conditional: a password changed meanwhile is not overwritten with the old one.
    await ctx.db
      .update(users)
      .set({ passwordHash })
      .where(and(eq(users.id, user.id), eq(users.passwordHash, user.passwordHash)));
  }
  const session = await createSession(ctx, user.id);
  return ok({ user: { id: user.id, email: user.email, createdAt: user.createdAt }, session });
}
