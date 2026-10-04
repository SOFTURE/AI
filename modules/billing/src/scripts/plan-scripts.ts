// The operator's way to grant a plan and revoke a manual grant without the admin page: safe ops
// scripts (`@softure-ai/ops/scripts`), dry run by default, `--commit` writes. They write through
// `grantPlanManually` and `revokeManualGrant`, so a script's grant is in the account's history like
// the admin page's, and either side can revoke the other's. Reports carry the user id, the
// entitlement and the active manual grants (with the ids `revoke-grant` takes), never the email.
import { ok, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Entitlement, PaymentGrant } from "../contract.js";
import { findPlan } from "../plans.js";
import { manualGrants } from "../schema.js";
import { getEntitlement, type BillingContext } from "../server/entitlements.js";
import { getAccountHistory, grantPlanManually, revokeManualGrant } from "../server/grants.js";
import { findAccountByEmail, getBillingPlans } from "../server/plans.js";
import { isUuid } from "../server/user-id.js";

export interface GrantPlanScriptArgs {
  readonly email: string;
  readonly plan: string;
}

export interface RevokeGrantScriptArgs {
  readonly email: string;
  readonly grant: string;
}

export interface PlanScriptOptions {
  /** The time stored as `granted_at` / `revoked_at`; the system clock by default. */
  readonly clock?: Clock;
}

const EMAIL = z.string().min(1, "--email=<account email> is required");

const grantPlanArgs = z.strictObject({
  email: EMAIL,
  plan: z.string().min(1, "--plan=<plan id> is required"),
});

const revokeGrantArgs = z.strictObject({
  email: EMAIL,
  grant: z.string().min(1, "--grant=<manual grant id> is required"),
});

const NO_ACCOUNT = "no account has this email";

/** An active manual grant as the report lists it. */
interface ActiveGrant {
  readonly id: string;
  readonly planId: string;
  readonly grantedAt: Date;
  readonly grant: PaymentGrant;
}

interface AccountState {
  readonly userId: string;
  readonly access: Entitlement | null;
  /** Newest first, as the admin page's history lists them. */
  readonly grants: readonly ActiveGrant[];
}

async function describeAccount(ctx: BillingContext, userId: string): Promise<AccountState> {
  const history = await getAccountHistory(ctx, userId);
  const grants = history.flatMap((entry) =>
    entry.source === "manual" && entry.status === "active" ? [{ id: entry.id, planId: entry.planId, grantedAt: entry.at, grant: entry.grant }] : [],
  );
  return { userId, access: await getEntitlement(ctx, userId), grants };
}

function describeDeclared(config: SoftureConfig): string {
  return getBillingPlans(config)
    .map((plan) => plan.id)
    .join(", ");
}

/** Whether `grantId` is an active manual grant of the account (its own select: the history is capped). */
async function hasActiveGrant(db: Queryable, userId: string, grantId: string): Promise<boolean> {
  if (!isUuid(grantId)) return false;
  const [row] = await db
    .select({ id: manualGrants.id })
    .from(manualGrants)
    .where(and(eq(manualGrants.id, grantId), eq(manualGrants.userId, userId), eq(manualGrants.status, "active")));
  return row !== undefined;
}

/** `grant-plan --email=… --plan=…`: grants one payment of a declared plan by hand and records it. */
export function createGrantPlanScript(config: SoftureConfig, options: PlanScriptOptions = {}): OpsScript<GrantPlanScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "grant-plan",
    description: "Grants one payment of a plan to the account with the given email, recorded in its billing history.",
    usage: ["--email=<account email>", "--plan=<plan id from billing({ plans })>"],
    args: grantPlanArgs,
    run: async (tx, args) => {
      const ctx: BillingContext = { db: tx, clock, config };
      if (findPlan(getBillingPlans(config), args.plan) === undefined) {
        return refuseOpsScript(`plan "${args.plan}" is not declared (declared: ${describeDeclared(config)})`);
      }
      const account = await findAccountByEmail(ctx, args.email);
      if (account === null) return refuseOpsScript(NO_ACCOUNT);
      const before = await describeAccount(ctx, account.id);
      const granted = await grantPlanManually(ctx, { userId: account.id, planId: args.plan, adminId: null });
      if (!granted.ok) {
        switch (granted.error) {
          case "billing.lifetime_active":
            return refuseOpsScript("the account has lifetime access already");
          case "billing.account_unknown":
            // Deleted between the lookup and the grant's lock.
            return refuseOpsScript(NO_ACCOUNT);
          case "billing.plan_unknown":
          case "billing.request_closed":
            // The plan was checked above and no request is given.
            throw new Error(`grant-plan: granting plan "${args.plan}" failed with ${granted.error}`);
        }
      }
      return ok({ before, after: await describeAccount(ctx, account.id) });
    },
  });
}

/** `revoke-grant --email=… --grant=…`: revokes one active manual grant and takes back what it added. */
export function createRevokeGrantScript(config: SoftureConfig, options: PlanScriptOptions = {}): OpsScript<RevokeGrantScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "revoke-grant",
    description: "Revokes a manual plan grant of the account with the given email and takes back what it added.",
    usage: ["--email=<account email>", "--grant=<manual grant id, listed by a dry run of either script>"],
    args: revokeGrantArgs,
    run: async (tx, args) => {
      const ctx: BillingContext = { db: tx, clock, config };
      const account = await findAccountByEmail(ctx, args.email);
      if (account === null) return refuseOpsScript(NO_ACCOUNT);
      const before = await describeAccount(ctx, account.id);
      const noGrant = `the account has no active manual grant "${args.grant}"`;
      if (!(await hasActiveGrant(tx, account.id, args.grant))) return refuseOpsScript(noGrant);
      const revoked = await revokeManualGrant(ctx, { grantId: args.grant, adminId: null });
      // Revoked by the admin page between the check and the revoke's lock.
      if (!revoked.ok) return refuseOpsScript(noGrant);
      return ok({ before, after: await describeAccount(ctx, account.id) });
    },
  });
}
