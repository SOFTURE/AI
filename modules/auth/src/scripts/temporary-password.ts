// The operator's account recovery: a safe ops script (`@softure-ai/ops/scripts`), dry run by
// default, `--commit` writes. It sets a random password, ends every session of the account and its
// pending reset link, and prints the password once for the operator to hand over through a channel
// that proves the owner (a reply to the account's own address). Reports carry the user id, never the email.
import { randomBytes } from "node:crypto";
import { ok, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { passwordResets, sessions, users } from "../schema.js";
import { getAuthOptions } from "../server/options.js";
import { hashPassword } from "../server/password.js";
import { revokeUserSessions, type AuthContext } from "../server/sessions.js";
import { normalizeEmail } from "../server/validation.js";

/** Long enough to be out of guessing range in any rate limit window. */
const MIN_TEMPORARY_LENGTH = 20;

export interface TemporaryPasswordScriptArgs {
  readonly email: string;
}

export interface TemporaryPasswordScriptOptions {
  /** The time stored as `password_changed_at`; the system clock by default. */
  readonly clock?: Clock;
}

const scriptArgs = z.strictObject({ email: z.string().min(1, "--email=<account email> is required") });

/** A random password of `length` base64url characters. */
function createTemporaryPassword(length: number): string {
  return randomBytes(Math.ceil((length * 3) / 4)).toString("base64url").slice(0, length);
}

/** `set-temporary-password --email=…`: a new random password, every session and reset link ended. */
export function createSetTemporaryPasswordScript(
  config: SoftureConfig,
  options: TemporaryPasswordScriptOptions = {},
): OpsScript<TemporaryPasswordScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "set-temporary-password",
    description: "Sets a random password for the account with the given email and ends its sessions and reset link.",
    usage: ["--email=<account email>"],
    args: scriptArgs,
    run: async (tx, args) => {
      const ctx: AuthContext = { db: tx, clock, config };
      const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.email, normalizeEmail(args.email))).limit(1);
      if (account === undefined) return refuseOpsScript("no account has this email");
      const before = { userId: account.id, sessions: (await tx.select().from(sessions).where(eq(sessions.userId, account.id))).length };

      const authOptions = getAuthOptions(config);
      const temporaryPassword = createTemporaryPassword(Math.max(authOptions.password.minLength, MIN_TEMPORARY_LENGTH));
      const passwordHash = await hashPassword(temporaryPassword, authOptions.password.scrypt);
      await tx.update(users).set({ passwordHash, passwordChangedAt: clock.now() }).where(eq(users.id, account.id));
      await revokeUserSessions(ctx, account.id);
      await tx.delete(passwordResets).where(eq(passwordResets.userId, account.id));
      const remaining = (await tx.select().from(sessions).where(eq(sessions.userId, account.id))).length;
      return ok({ before, after: { userId: account.id, sessions: remaining, temporaryPassword } });
    },
  });
}
