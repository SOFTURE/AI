// Re-authentication before an action that cannot be undone, such as deleting the account: the
// signed-in user types their password again, so a session cookie alone is not enough.
import { eq } from "drizzle-orm";
import { users } from "../schema.js";
import { verifyPassword } from "./password.js";
import type { AuthContext } from "./sessions.js";

/**
 * Whether `password` is the current password of the account. False for an unknown account. The
 * caller counts the attempt in a rate limit bucket first: this is a password check like a login.
 */
export async function isCurrentPassword(ctx: AuthContext, userId: string, password: string): Promise<boolean> {
  const [stored] = await ctx.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (stored === undefined) return false;
  return verifyPassword(password, stored.passwordHash);
}
