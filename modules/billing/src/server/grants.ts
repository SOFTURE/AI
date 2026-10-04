// Plans an admin grants by hand (the manual adapter's second half): each grant is recorded in
// `billing.manual_grants` with what it added, who granted it and the request it answered, so a
// mistaken one is revoked by taking back only that, and an account's history lists it beside its
// provider payments. Locks follow `refundPayment`'s order (account, then the entitlement, then the
// grant or request row), so none of them deadlock.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, desc, eq } from "drizzle-orm";
import type { AdminErrorCode, Entitlement, PaymentGrant } from "../contract.js";
import { findPlan } from "../plans.js";
import { manualGrants, paymentRequests, payments } from "../schema.js";
import { findEntitlementRecord, type BillingContext } from "./entitlements.js";
import { getGrantColumns, readGrant } from "./payments.js";
import { applyPlan, getBillingPlans } from "./plans.js";
import { findOpenRequest, getClosedRequestColumns } from "./requests.js";
import { hasActiveManualLifetime, hasPaidLifetimePayment, lockEntitlementRow, takeBackGrant } from "./take-back.js";
import { isUserId, isUuid } from "./user-id.js";

export interface GrantPlanManuallyInput {
  readonly userId: string;
  readonly planId: string;
  /** The admin who grants; null for a grant without one (a script). */
  readonly adminId: string | null;
  /** The open request this grant answers; it is closed in the same transaction. */
  readonly requestId?: string;
}

export interface ManualGrantResult {
  readonly grantId: string;
  /** Where the account stands after the grant. */
  readonly entitlement: Entitlement;
}

export type GrantPlanManuallyError = "billing.plan_unknown" | "billing.account_unknown" | "billing.lifetime_active" | "billing.request_closed";

/**
 * Grants one payment of a plan by hand and records it, in one transaction: a paid period that
 * starts when the account's current access ends, or lifetime access. Refuses an account that has
 * lifetime access already, and a request that is no longer open; every refusal writes nothing.
 * Database errors propagate.
 */
export async function grantPlanManually(ctx: BillingContext, input: GrantPlanManuallyInput): Promise<Ok<ManualGrantResult> | Err<GrantPlanManuallyError>> {
  if (findPlan(getBillingPlans(ctx.config), input.planId) === undefined) return err("billing.plan_unknown");
  if (!isUserId(input.userId)) return err("billing.account_unknown");
  if (input.requestId !== undefined && !isUuid(input.requestId)) return err("billing.request_closed");
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    // A shared lock: the account cannot be deleted before the grant below.
    const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).for("key share");
    if (account === undefined) return err("billing.account_unknown");
    // The entitlement locked before the check, so a lifetime granted meanwhile is seen here.
    await lockEntitlementRow(tx, input.userId);
    const record = await findEntitlementRecord({ ...ctx, db: tx }, input.userId);
    if (record?.isLifetime === true) return err("billing.lifetime_active");

    if (input.requestId !== undefined) {
      const [closed] = await tx
        .update(paymentRequests)
        .set(getClosedRequestColumns("granted", now))
        .where(and(eq(paymentRequests.id, input.requestId), eq(paymentRequests.userId, input.userId), eq(paymentRequests.status, "open")))
        .returning();
      // Nothing written yet: the request was granted or dismissed meanwhile, or is another account's.
      if (closed === undefined) return err("billing.request_closed");
    }

    const applied = await applyPlan({ ...ctx, db: tx }, input.userId, input.planId);
    // The plan and the locked account were checked above, and a plan grant always ends later.
    if (!applied.ok) throw new Error(`@softure-ai/billing: granting plan "${input.planId}" by hand failed with ${applied.error}`);
    const { grant } = applied.value;
    // A plan grant always adds a period of at least a day, or lifetime access.
    if (grant === null) throw new Error(`@softure-ai/billing: plan "${input.planId}" was granted by hand but added nothing`);
    const [row] = await tx
      .insert(manualGrants)
      .values({
        userId: input.userId,
        planId: input.planId,
        requestId: input.requestId ?? null,
        grantedBy: input.adminId,
        grantedAt: now,
        ...getGrantColumns(grant),
        grantKind: grant.kind,
        status: "active",
      })
      .returning();
    if (row === undefined) throw new Error("@softure-ai/billing: recording a manual grant returned no row");
    return ok({ grantId: row.id, entitlement: applied.value.entitlement });
  });
}

export interface GrantPaymentRequestInput {
  readonly requestId: string;
  readonly adminId: string | null;
}

/** Grants the plan an open request asked for and closes the request (`grantPlanManually`). */
export async function grantPaymentRequest(ctx: BillingContext, input: GrantPaymentRequestInput): Promise<Ok<ManualGrantResult> | Err<GrantPlanManuallyError>> {
  const request = await findOpenRequest(ctx.db, input.requestId);
  if (request === undefined) return err("billing.request_closed");
  return grantPlanManually(ctx, { userId: request.userId, planId: request.planId, adminId: input.adminId, requestId: input.requestId });
}

export interface RevokeManualGrantInput {
  readonly grantId: string;
  readonly adminId: string | null;
}

/**
 * Revokes a manual grant and takes back what it added, in one transaction: a period loses its
 * unused days (later periods move back), a lifetime ends unless another active manual lifetime or a
 * paid lifetime payment still gives it. `billing.grant_revoked` when it was revoked before or never
 * existed. Database errors propagate.
 */
export async function revokeManualGrant(ctx: BillingContext, input: RevokeManualGrantInput): Promise<Ok<Entitlement> | Err<Extract<AdminErrorCode, "billing.grant_revoked">>> {
  if (!isUuid(input.grantId)) return err("billing.grant_revoked");
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const [found] = await tx.select({ userId: manualGrants.userId }).from(manualGrants).where(eq(manualGrants.id, input.grantId));
    if (found === undefined) return err("billing.grant_revoked");
    // The account first (the lock order of every change), the entitlement, then the conditional update.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, found.userId)).for("key share");
    await lockEntitlementRow(tx, found.userId);
    const [revoked] = await tx
      .update(manualGrants)
      .set({ status: "revoked", revokedAt: now, revokedBy: input.adminId })
      .where(and(eq(manualGrants.id, input.grantId), eq(manualGrants.status, "active")))
      .returning();
    // Revoked by a concurrent click, or erased with the account in the meantime.
    if (revoked === undefined) return err("billing.grant_revoked");
    const { entitlement } = await takeBackGrant(
      { ...ctx, db: tx },
      {
        userId: found.userId,
        grant: readGrant(revoked),
        now,
        hasOtherLifetime: async () => (await hasActiveManualLifetime(tx, found.userId, revoked.id)) || (await hasPaidLifetimePayment(tx, found.userId)),
      },
    );
    return ok(entitlement);
  });
}

/** One line of an account's history: a grant typed in by an admin, or a payment a provider reported. */
export type AccountHistoryEntry =
  | {
      readonly source: "manual";
      readonly id: string;
      readonly planId: string;
      readonly at: Date;
      readonly grant: PaymentGrant;
      readonly status: "active" | "revoked";
      readonly revokedAt: Date | null;
      /** Whether it answered an invoice request. */
      readonly isFromRequest: boolean;
    }
  | {
      readonly source: "provider";
      readonly id: string;
      readonly provider: string;
      readonly planId: string;
      readonly at: Date;
      /** Null for a payment recorded before grants were. */
      readonly grant: PaymentGrant | null;
      readonly amount: number;
      readonly currency: string;
      readonly status: "paid" | "refunded";
      readonly refundedAt: Date | null;
    };

/** How many entries of each source the history reads. */
export const ACCOUNT_HISTORY_LIMIT = 100;

/** The account's manual grants and provider payments, newest first. Database errors propagate. */
export async function getAccountHistory(ctx: Pick<BillingContext, "db">, userId: string): Promise<readonly AccountHistoryEntry[]> {
  if (!isUserId(userId)) return [];
  const grantRows = await ctx.db
    .select()
    .from(manualGrants)
    .where(eq(manualGrants.userId, userId))
    .orderBy(desc(manualGrants.grantedAt), desc(manualGrants.id))
    .limit(ACCOUNT_HISTORY_LIMIT);
  const paymentRows = await ctx.db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.paidAt), desc(payments.id))
    .limit(ACCOUNT_HISTORY_LIMIT);
  const entries: AccountHistoryEntry[] = [];
  for (const row of grantRows) {
    const grant = readGrant(row);
    // The CHECK on manual_grants requires a complete grant on every row.
    if (grant === null) throw new Error(`@softure-ai/billing: manual grant ${row.id} has no grant recorded`);
    entries.push({ source: "manual", id: row.id, planId: row.planId, at: row.grantedAt, grant, status: row.status, revokedAt: row.revokedAt, isFromRequest: row.requestId !== null });
  }
  for (const row of paymentRows) {
    entries.push({
      source: "provider",
      id: row.id,
      provider: row.provider,
      planId: row.planId,
      at: row.paidAt,
      grant: readGrant(row),
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      refundedAt: row.refundedAt,
    });
  }
  return entries.sort((first, second) => second.at.getTime() - first.at.getTime());
}
