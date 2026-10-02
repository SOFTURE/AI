// Roles: rows of auth.user_roles, plus `admin` for the accounts listed in `adminEmails`. Nothing is
// granted by default, so with no admin configured every admin-only surface stays closed.
import { err, ok, type Err, type Ok, type SoftureConfig } from "@softure-ai/core";
import { and, eq } from "drizzle-orm";
import type { AuthUser } from "../contract.js";
import { ADMIN_ROLE } from "../roles.js";
import { userRoles } from "../schema.js";
import { getAuthOptions } from "./options.js";
import type { AuthContext } from "./sessions.js";

export type RoleErrorCode = "auth.role_undeclared" | "auth.role_already_granted" | "auth.role_not_granted";

export interface RoleChange {
  readonly userId: string;
  readonly role: string;
}

/** `admin` and the roles the app declared in `auth({ roles })`. */
export function getDeclaredRoles(config: SoftureConfig): ReadonlySet<string> {
  return new Set([ADMIN_ROLE, ...getAuthOptions(config).roles]);
}

export function isDeclaredRole(config: SoftureConfig, role: string): boolean {
  return getDeclaredRoles(config).has(role);
}

/**
 * Throws for a role the app never declared: a check for a mistyped role is a bug, and it must
 * fail loudly instead of quietly denying (or, worse, allowing) everyone.
 */
export function assertDeclaredRole(config: SoftureConfig, role: string): void {
  if (!isDeclaredRole(config, role)) {
    const declared = [...getDeclaredRoles(config)].join(", ");
    throw new Error(`@softure-ai/auth: role "${role}" is not declared (declared: ${declared}); add it to auth({ roles }) in softure.config.ts`);
  }
}

/** Whether `adminEmails` makes this account an admin. */
export function isConfiguredAdmin(config: SoftureConfig, user: Pick<AuthUser, "email">): boolean {
  return getAuthOptions(config).adminEmails.includes(user.email);
}

/** Every role the user holds: its rows, and `admin` when its email is in `adminEmails`. */
export async function findUserRoles(ctx: AuthContext, user: Pick<AuthUser, "id" | "email">): Promise<ReadonlySet<string>> {
  const rows = await ctx.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
  const roles = new Set(rows.map((row) => row.role));
  if (isConfiguredAdmin(ctx.config, user)) roles.add(ADMIN_ROLE);
  return roles;
}

/** Stores a declared role for a user. An unknown user id is a foreign key error and propagates. */
export async function grantRole(
  ctx: AuthContext,
  change: RoleChange,
): Promise<Ok<undefined> | Err<"auth.role_undeclared" | "auth.role_already_granted">> {
  if (!isDeclaredRole(ctx.config, change.role)) return err("auth.role_undeclared");
  const inserted = await ctx.db
    .insert(userRoles)
    .values({ userId: change.userId, role: change.role, grantedAt: ctx.clock.now() })
    .onConflictDoNothing()
    .returning();
  return inserted.length === 0 ? err("auth.role_already_granted") : ok();
}

/** Deletes a stored role. It cannot take away an `admin` that comes from `adminEmails`. */
export async function revokeRole(ctx: AuthContext, change: RoleChange): Promise<Ok<undefined> | Err<"auth.role_not_granted">> {
  const deleted = await ctx.db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, change.userId), eq(userRoles.role, change.role)))
    .returning();
  return deleted.length === 0 ? err("auth.role_not_granted") : ok();
}
