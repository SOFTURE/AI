// The usage limits of an account: its state from the entitlement, and for paid access the plan
// paying for today, read from the grants billing records (provider payments and manual grants).
// Take-backs keep those grants' dates true (`take-back.ts`), so the earliest period that has not
// ended is the plan in force (the one holding `now`, or the first one after a trial it was bought
// during); a lifetime grant still paid for wins.
import type { Queryable } from "@softure-ai/db";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import type { AccountLimits } from "../contract.js";
import { resolveLimits } from "../usage.js";
import { manualGrants, payments } from "../schema.js";
import { getEntitlement, type BillingContext } from "./entitlements.js";
import { getBillingOptions } from "./options.js";

interface GrantCandidate {
  readonly planId: string;
  /** When the grant was made (lifetime grants), or when its period starts. */
  readonly at: Date;
}

/** The latest lifetime grant of each table that still pays: a paid payment, an active manual grant. */
async function findLifetimeGrants(db: Queryable, userId: string): Promise<GrantCandidate[]> {
  const paid = await db
    .select({ planId: payments.planId, at: payments.paidAt })
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "paid"), eq(payments.grantKind, "lifetime")))
    .orderBy(desc(payments.paidAt))
    .limit(1);
  const granted = await db
    .select({ planId: manualGrants.planId, at: manualGrants.grantedAt })
    .from(manualGrants)
    .where(and(eq(manualGrants.userId, userId), eq(manualGrants.status, "active"), eq(manualGrants.grantKind, "lifetime")))
    .orderBy(desc(manualGrants.grantedAt))
    .limit(1);
  return [...paid, ...granted];
}

/** The earliest period grant of each table that has not ended at `now`. */
async function findPeriodGrants(db: Queryable, userId: string, now: Date): Promise<GrantCandidate[]> {
  const paid = await db
    .select({ planId: payments.planId, at: payments.grantedFrom })
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "paid"), eq(payments.grantKind, "period"), gt(payments.grantedUntil, now)))
    .orderBy(asc(payments.grantedFrom))
    .limit(1);
  const granted = await db
    .select({ planId: manualGrants.planId, at: manualGrants.grantedFrom })
    .from(manualGrants)
    .where(and(eq(manualGrants.userId, userId), eq(manualGrants.status, "active"), eq(manualGrants.grantKind, "period"), gt(manualGrants.grantedUntil, now)))
    .orderBy(asc(manualGrants.grantedFrom))
    .limit(1);
  // A period grant always has its start (the tables' grant shape constraints).
  return [...paid, ...granted].flatMap((grant) => (grant.at === null ? [] : [{ planId: grant.planId, at: grant.at }]));
}

/**
 * The plan paying for the account at `now`: its latest lifetime grant still paid for, else the
 * earliest period grant that has not ended (the one holding `now`, or the first after a trial it was
 * bought during); null when no recorded grant is left (an import, a grant applied by hand). Reads only.
 */
export async function findCurrentPlanId(db: Queryable, userId: string, now: Date): Promise<string | null> {
  const lifetimes = await findLifetimeGrants(db, userId);
  const lifetime = lifetimes.reduce<GrantCandidate | undefined>((latest, grant) => (latest === undefined || grant.at > latest.at ? grant : latest), undefined);
  if (lifetime !== undefined) return lifetime.planId;
  const periods = await findPeriodGrants(db, userId, now);
  return periods.reduce<GrantCandidate | undefined>((earliest, grant) => (earliest === undefined || grant.at < earliest.at ? grant : earliest), undefined)?.planId ?? null;
}

/**
 * The account's state, the plan paying for today (paid access only) and the limit of every declared
 * meter; null when no account has this id. A plan id the config no longer declares is reported, and
 * its meters fall back to `paid.limits`. Database errors propagate.
 */
export async function getLimits(ctx: BillingContext, userId: string): Promise<AccountLimits | null> {
  const entitlement = await getEntitlement(ctx, userId);
  if (entitlement === null) return null;
  const planId = entitlement.status === "paid" ? await findCurrentPlanId(ctx.db, userId, ctx.clock.now()) : null;
  const subject = { status: entitlement.status, planId };
  return { ...subject, limits: resolveLimits(getBillingOptions(ctx.config), subject) };
}
