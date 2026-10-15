// The first account of an app whose registration is closed: a safe ops script
// (`@softure-ai/ops/scripts`), dry run by default, `--commit` writes. It creates the account with a
// drawn temporary password, printed once, or with a `hashPassword` hash computed elsewhere
// (`--password-hash`, best through `--password-hash-file=-`). With `maxAccounts` it refuses once the
// table holds that many accounts; the table is locked for the run, so two runs cannot both pass.
// The app's `onRegistered` hook does not run: nobody gave consent and there are no registration
// fields. Reports carry the user id, never the email or the hash.
import { ok, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { count, sql } from "drizzle-orm";
import { z } from "zod";
import { users } from "../schema.js";
import { parseEmail } from "../server/validation.js";
import { choosePassword, describeChosenPassword, PASSWORD_HASH_KEY, PASSWORD_HASH_USAGE, passwordHashArg } from "./password-choice.js";

export interface CreateAccountScriptArgs {
  readonly email: string;
  /** A hash from `hashPassword`, computed where the password was made; the script then draws none. */
  readonly "password-hash"?: string;
}

export interface CreateAccountScriptOptions {
  /** The time stored as `created_at` and `password_changed_at`; the system clock by default. */
  readonly clock?: Clock;
  /** The characters a drawn password uses (e.g. `READABLE_PASSWORD_ALPHABET`); base64url by default. */
  readonly alphabet?: string;
  /** The most accounts the app holds (e.g. 1 for a single-owner app); the script refuses beyond it. No limit by default. */
  readonly maxAccounts?: number;
}

const scriptArgs = z.strictObject({
  email: z.string().min(1, "--email=<account email> is required"),
  [PASSWORD_HASH_KEY]: passwordHashArg,
});

/** `create-account --email=… [--password-hash=…]`: a new account, with or without registration open. */
export function createCreateAccountScript(config: SoftureConfig, options: CreateAccountScriptOptions = {}): OpsScript<CreateAccountScriptArgs> {
  const { maxAccounts } = options;
  if (maxAccounts !== undefined && !(Number.isInteger(maxAccounts) && maxAccounts >= 1)) {
    throw new Error("@softure-ai/auth: createCreateAccountScript needs maxAccounts to be a whole number of at least 1");
  }
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "create-account",
    description: "Creates an account with the given email and a random password (or the given hash), also while registration is closed.",
    usage: ["--email=<account email>", PASSWORD_HASH_USAGE],
    args: scriptArgs,
    secrets: [PASSWORD_HASH_KEY],
    run: async (tx, args) => {
      const email = parseEmail(args.email);
      if (!email.ok) return refuseOpsScript("the email is not valid");
      // Conflicts with itself and with every insert, until the script's transaction ends.
      await tx.execute(sql`LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE`);
      const [counted] = await tx.select({ accounts: count() }).from(users);
      const accounts = counted?.accounts ?? 0;
      if (maxAccounts !== undefined && accounts >= maxAccounts) {
        return refuseOpsScript(`the app already holds ${String(accounts)} account(s), its maxAccounts`);
      }

      const password = await choosePassword(args[PASSWORD_HASH_KEY], config, options.alphabet);
      const now = clock.now();
      const [created] = await tx
        .insert(users)
        .values({ email: email.value, passwordHash: password.hash, createdAt: now, passwordChangedAt: now })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });
      if (created === undefined) return refuseOpsScript("an account with this email already exists");
      return ok({ before: { accounts }, after: { userId: created.id, accounts: accounts + 1, ...describeChosenPassword(password) } });
    },
  });
}
