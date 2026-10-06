// An account written straight to auth's tables, hashed the way registration hashes it. No
// `onRegistered` hook runs and no session is opened: the test signs in through the login form.
import type { Queryable } from "@softure-ai/db";
import type { AuthUser } from "../contract.js";
import { DEFAULT_SCRYPT_COST, type ScryptParams } from "../options.js";
import { userRoles, users } from "../schema.js";
import { hashPassword } from "../server/password.js";
import { parseEmail } from "../server/validation.js";

/** Auth's own hash parameters when the app sets none (`password.scrypt` in `auth({ ... })`). */
const DEFAULT_SCRYPT: ScryptParams = { cost: DEFAULT_SCRYPT_COST, blockSize: 8, parallelization: 1 };

export interface TestAccountInput {
  readonly email: string;
  readonly password: string;
  /** Rows of `auth.user_roles`, e.g. `["admin"]`. */
  readonly roles?: readonly string[];
  /** The app's hash parameters (`getAuthOptions(config).password.scrypt`), so its login does not rehash. */
  readonly scrypt?: ScryptParams;
}

/**
 * Creates an account and its roles in one transaction and returns it. The email is normalized as
 * registration normalizes it. An invalid or taken email throws: in test setup it is a bug of the test.
 */
export async function createTestAccount(db: Queryable, input: TestAccountInput): Promise<AuthUser> {
  const email = parseEmail(input.email);
  if (!email.ok) throw new Error(`createTestAccount: "${input.email}" is not a valid email`);
  const passwordHash = await hashPassword(input.password, input.scrypt ?? DEFAULT_SCRYPT);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({ email: email.value, passwordHash, createdAt: now, passwordChangedAt: now })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (row === undefined) throw new Error(`createTestAccount: an account with the email "${email.value}" already exists`);
    const roles = input.roles ?? [];
    if (roles.length > 0) await tx.insert(userRoles).values(roles.map((role) => ({ userId: row.id, role, grantedAt: now })));
    return { id: row.id, email: row.email, createdAt: row.createdAt };
  });
}
