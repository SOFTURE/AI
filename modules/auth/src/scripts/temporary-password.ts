// The operator's account recovery: a safe ops script (`@softure-ai/ops/scripts`), dry run by
// default, `--commit` writes. It sets a new password, ends every session of the account and its
// pending reset link. Either the script draws a random password and prints it once for the operator
// to hand over through a channel that proves the owner (a reply to the account's own address), or
// the operator computes the password and its hash locally and passes only the hash
// (`--password-hash`, best through `--password-hash-file=-`), so the plain password never reaches
// the server. Reports carry the user id, never the email or the hash.
import { ok, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { passwordResets, sessions, users } from "../schema.js";
import { getAuthOptions } from "../server/options.js";
import { hashPassword, isPasswordHash } from "../server/password.js";
import { revokeUserSessions, type AuthContext } from "../server/sessions.js";
import { createTemporaryPassword } from "../server/temporary-password.js";
import { normalizeEmail } from "../server/validation.js";

/** Long enough to be out of guessing range in any rate limit window. */
const MIN_TEMPORARY_LENGTH = 20;
const PASSWORD_HASH_KEY = "password-hash";

export interface TemporaryPasswordScriptArgs {
  readonly email: string;
  /** A hash from `hashPassword`, computed where the password was made; the script then draws none. */
  readonly "password-hash"?: string;
}

export interface TemporaryPasswordScriptOptions {
  /** The time stored as `password_changed_at`; the system clock by default. */
  readonly clock?: Clock;
  /** The characters a drawn password uses (e.g. `READABLE_PASSWORD_ALPHABET`); base64url by default. */
  readonly alphabet?: string;
}

const scriptArgs = z.strictObject({
  email: z.string().min(1, "--email=<account email> is required"),
  // A constant message: the value is secret-derived and must not be echoed.
  [PASSWORD_HASH_KEY]: z.string().refine(isPasswordHash, "is not a scrypt hash written by @softure-ai/auth").optional(),
});

/** `set-temporary-password --email=… [--password-hash=…]`: a new password, every session and reset link ended. */
export function createSetTemporaryPasswordScript(
  config: SoftureConfig,
  options: TemporaryPasswordScriptOptions = {},
): OpsScript<TemporaryPasswordScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "set-temporary-password",
    description:
      "Sets a new password for the account with the given email (a random one, or the given hash) and ends its sessions and reset link.",
    usage: ["--email=<account email>", `--${PASSWORD_HASH_KEY}=<hash>  store this hashPassword() hash instead of drawing a password`],
    args: scriptArgs,
    secrets: [PASSWORD_HASH_KEY],
    run: async (tx, args) => {
      const ctx: AuthContext = { db: tx, clock, config };
      const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.email, normalizeEmail(args.email))).limit(1);
      if (account === undefined) return refuseOpsScript("no account has this email");
      const before = { userId: account.id, sessions: (await tx.select().from(sessions).where(eq(sessions.userId, account.id))).length };

      const password = await choosePassword(args[PASSWORD_HASH_KEY], config, options.alphabet);
      await tx.update(users).set({ passwordHash: password.hash, passwordChangedAt: clock.now() }).where(eq(users.id, account.id));
      await revokeUserSessions(ctx, account.id);
      await tx.delete(passwordResets).where(eq(passwordResets.userId, account.id));
      const remaining = (await tx.select().from(sessions).where(eq(sessions.userId, account.id))).length;
      const after = password.from === "hash" ? { passwordFrom: "hash" } : { temporaryPassword: password.plain };
      return ok({ before, after: { userId: account.id, sessions: remaining, ...after } });
    },
  });
}

type ChosenPassword = { readonly from: "hash"; readonly hash: string } | { readonly from: "drawn"; readonly hash: string; readonly plain: string };

/** The given hash, or a drawn password of at least 20 characters and `password.minLength`, with its hash. */
async function choosePassword(givenHash: string | undefined, config: SoftureConfig, alphabet: string | undefined): Promise<ChosenPassword> {
  if (givenHash !== undefined) return { from: "hash", hash: givenHash };
  const { password } = getAuthOptions(config);
  const plain = createTemporaryPassword({ alphabet, length: Math.max(password.minLength, MIN_TEMPORARY_LENGTH) });
  return { from: "drawn", hash: await hashPassword(plain, password.scrypt), plain };
}
