// An account written straight to auth's tables, hashed the way registration hashes it. No session
// is opened: the test signs in through the login form. The app's `onRegistered` hook runs only on
// request (`runHooks`), so fixture rows the app's hooks write (a profile, an entitlement) exist too.
import type { Queryable } from "@softure-ai/db";
import type { AuthUser } from "../contract.js";
import { DEFAULT_SCRYPT_COST, type ScryptParams } from "../options.js";
import { userRoles, users } from "../schema.js";
import { getAuthOptions } from "../server/options.js";
import { hashPassword, isPasswordHash } from "../server/password.js";
import type { AuthContext } from "../server/sessions.js";
import { parseEmail } from "../server/validation.js";

/** Auth's own hash parameters when the app sets none (`password.scrypt` in `auth({ ... })`). */
const DEFAULT_SCRYPT: ScryptParams = { cost: DEFAULT_SCRYPT_COST, blockSize: 8, parallelization: 1 };

/** One hash per password and parameters for the whole test run: scrypt is the slow part of a big suite's setup. */
const hashCache = new Map<string, Promise<string>>();

interface TestAccountBase {
  readonly email: string;
  /** The row's id (a uuid); the database draws one when absent. */
  readonly id?: string;
  /** `created_at` and `password_changed_at`; now when absent. */
  readonly createdAt?: Date;
  /** Rows of `auth.user_roles`, e.g. `["admin"]`. */
  readonly roles?: readonly string[];
  /** Run the app's `onRegistered` hook in the account's transaction. Needs a module context as the first argument. */
  readonly runHooks?: boolean;
  /** `event.fields` for the hook, as the register form would send the app's `registrationFields`. */
  readonly fields?: Readonly<Record<string, string>>;
}

/** An account with a password, hashed here (once per password and parameters). */
export interface TestAccountInput extends TestAccountBase {
  readonly password: string;
  /** Hash parameters; the app's (`getAuthOptions(config).password.scrypt`) when a module context is given, else auth's default. */
  readonly scrypt?: ScryptParams;
  readonly passwordHash?: never;
}

/** An account with a ready hash, stored as is. */
export interface TestAccountHashInput extends TestAccountBase {
  /** A ready hash from `hashPassword`, stored as is: nothing is hashed. */
  readonly passwordHash: string;
  readonly password?: never;
  readonly scrypt?: never;
}

/**
 * Creates an account and its roles in one transaction and returns it. The email is normalized as
 * registration normalizes it. An invalid or taken email, a malformed `passwordHash` or a hook that
 * throws rolls everything back and throws: in test setup it is a bug of the test.
 */
export async function createTestAccount(target: Queryable | AuthContext, input: TestAccountInput | TestAccountHashInput): Promise<AuthUser> {
  const ctx = isModuleContext(target) ? target : null;
  const db = isModuleContext(target) ? target.db : target;
  const email = parseEmail(input.email);
  if (!email.ok) throw new Error(`createTestAccount: "${input.email}" is not a valid email`);
  if (input.runHooks === true && ctx === null) {
    throw new Error("createTestAccount: runHooks needs a module context ({ db, clock, config }) instead of a database");
  }
  const passwordHash = await readPasswordHash(input, email.value, ctx);
  const now = input.createdAt ?? new Date();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({ ...(input.id === undefined ? {} : { id: input.id }), email: email.value, passwordHash, createdAt: now, passwordChangedAt: now })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (row === undefined) throw new Error(`createTestAccount: an account with the email "${email.value}" already exists`);
    const roles = input.roles ?? [];
    if (roles.length > 0) await tx.insert(userRoles).values(roles.map((role) => ({ userId: row.id, role, grantedAt: now })));
    const user = { id: row.id, email: row.email, createdAt: row.createdAt };
    if (input.runHooks === true && ctx !== null) {
      const options = getAuthOptions(ctx.config);
      const consent = options.requireConsent ? { acceptedAt: now } : null;
      await options.onRegistered?.({ user, consent, fields: input.fields ?? {} }, { ...ctx, db: tx });
    }
    return user;
  });
}

async function readPasswordHash(input: TestAccountInput | TestAccountHashInput, email: string, ctx: AuthContext | null): Promise<string> {
  if (input.passwordHash !== undefined) {
    if (!isPasswordHash(input.passwordHash)) throw new Error(`createTestAccount: the passwordHash for "${email}" is not a hash from hashPassword`);
    return input.passwordHash;
  }
  const scrypt = input.scrypt ?? (ctx === null ? DEFAULT_SCRYPT : getAuthOptions(ctx.config).password.scrypt);
  const key = JSON.stringify([scrypt.cost, scrypt.blockSize, scrypt.parallelization, input.password]);
  let hash = hashCache.get(key);
  if (hash === undefined) {
    hash = hashPassword(input.password, scrypt);
    hashCache.set(key, hash);
    // A failed hash is not kept, so the next call tries again.
    void hash.catch(() => hashCache.delete(key));
  }
  return hash;
}

function isModuleContext(target: Queryable | AuthContext): target is AuthContext {
  return "config" in target && "clock" in target && "db" in target;
}
