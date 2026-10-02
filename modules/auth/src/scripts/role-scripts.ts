// The operator's way to grant and revoke roles: safe ops scripts (`@softure-ai/ops/scripts`), dry
// run by default, `--commit` writes. The app bundles them like its migrate step and runs them with
// its database URL. Reports carry the user id and roles, never the email.
import { ok, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ADMIN_ROLE } from "../roles.js";
import { users } from "../schema.js";
import { getDeclaredRoles, findUserRoles, grantRole, isConfiguredAdmin, isDeclaredRole, revokeRole } from "../server/roles.js";
import type { AuthContext } from "../server/sessions.js";
import { normalizeEmail } from "../server/validation.js";

export interface RoleScriptArgs {
  readonly email: string;
  readonly role: string;
}

export interface RoleScriptOptions {
  /** The time stored as `granted_at`; the system clock by default. */
  readonly clock?: Clock;
}

const roleScriptArgs = z.strictObject({
  email: z.string().min(1, "--email=<account email> is required"),
  role: z.string().min(1, "--role=<role> is required"),
});

const USAGE = ["--email=<account email>", "--role=<declared role, e.g. admin>"];

interface Account {
  readonly id: string;
  readonly email: string;
}

async function findAccount(db: Queryable, email: string): Promise<Account | undefined> {
  const [row] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return row;
}

async function describeRoles(ctx: AuthContext, account: Account): Promise<{ userId: string; roles: string[] }> {
  return { userId: account.id, roles: [...(await findUserRoles(ctx, account))].sort() };
}

function describeDeclared(config: SoftureConfig): string {
  return [...getDeclaredRoles(config)].join(", ");
}

/** `grant-role --email=… --role=…`: stores a declared role for one account. */
export function createGrantRoleScript(config: SoftureConfig, options: RoleScriptOptions = {}): OpsScript<RoleScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "grant-role",
    description: "Grants a declared role to the account with the given email.",
    usage: USAGE,
    args: roleScriptArgs,
    run: async (tx, args) => {
      const ctx: AuthContext = { db: tx, clock, config };
      if (!isDeclaredRole(config, args.role)) {
        return refuseOpsScript(`role "${args.role}" is not declared (declared: ${describeDeclared(config)})`);
      }
      const account = await findAccount(tx, args.email);
      if (account === undefined) return refuseOpsScript("no account has this email");
      const before = await describeRoles(ctx, account);
      const granted = await grantRole(ctx, { userId: account.id, role: args.role });
      if (!granted.ok) return refuseOpsScript(`the account already has role "${args.role}"`);
      return ok({ before, after: await describeRoles(ctx, account) });
    },
  });
}

/** `revoke-role --email=… --role=…`: deletes a stored role of one account. */
export function createRevokeRoleScript(config: SoftureConfig, options: RoleScriptOptions = {}): OpsScript<RoleScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "revoke-role",
    description: "Revokes a stored role from the account with the given email.",
    usage: USAGE,
    args: roleScriptArgs,
    run: async (tx, args) => {
      const ctx: AuthContext = { db: tx, clock, config };
      const account = await findAccount(tx, args.email);
      if (account === undefined) return refuseOpsScript("no account has this email");
      const before = await describeRoles(ctx, account);
      const revoked = await revokeRole(ctx, { userId: account.id, role: args.role });
      if (!revoked.ok) {
        const isFromConfig = args.role === ADMIN_ROLE && isConfiguredAdmin(config, account);
        return refuseOpsScript(
          isFromConfig
            ? "admin comes from auth({ adminEmails }) in softure.config.ts; remove the email there"
            : `the account has no stored role "${args.role}"`,
        );
      }
      return ok({ before, after: await describeRoles(ctx, account) });
    },
  });
}
