// The billing part of a GDPR export and deletion (`@softure-ai/privacy`): the account's entitlement
// row and its provider payments. An account without an entitlement row has no stored entitlement
// (its trial is derived from the account). The provider keeps its own records of the payments.
import { users } from "@softure-ai/auth";
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, eq } from "drizzle-orm";
import { entitlements, payments } from "../schema.js";
import { isUserId } from "./user-id.js";

/** One provider payment, as it appears in an export. */
export interface BillingPaymentData {
  readonly provider: string;
  readonly checkoutId: string;
  readonly paymentId: string | null;
  readonly planId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: "paid" | "refunded";
  readonly paidAt: Date;
  readonly refundedAt: Date | null;
  /** What the payment granted: `period` (from, until) or `lifetime`; null when recorded before grants were. */
  readonly grantKind: "period" | "lifetime" | null;
  readonly grantedFrom: Date | null;
  readonly grantedUntil: Date | null;
}

/** What billing holds about one user, as it appears in their export. */
export interface BillingUserData {
  readonly entitlement: {
    readonly trialEndsAt: Date;
    readonly paidUntil: Date | null;
    readonly isLifetime: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  } | null;
  /** Oldest first. */
  readonly payments: readonly BillingPaymentData[];
}

export async function exportBillingUserData(context: ModuleContext, userId: string): Promise<Ok<BillingUserData>> {
  if (!isUserId(userId)) return ok({ entitlement: null, payments: [] });
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const [row] = await db
    .select({
      trialEndsAt: entitlements.trialEndsAt,
      paidUntil: entitlements.paidUntil,
      isLifetime: entitlements.isLifetime,
      createdAt: entitlements.createdAt,
      updatedAt: entitlements.updatedAt,
    })
    .from(entitlements)
    .where(eq(entitlements.userId, userId));
  const paymentRows = await db
    .select({
      provider: payments.provider,
      checkoutId: payments.checkoutId,
      paymentId: payments.paymentId,
      planId: payments.planId,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      paidAt: payments.paidAt,
      refundedAt: payments.refundedAt,
      grantKind: payments.grantKind,
      grantedFrom: payments.grantedFrom,
      grantedUntil: payments.grantedUntil,
    })
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(asc(payments.paidAt), asc(payments.id));
  return ok({ entitlement: row ?? null, payments: paymentRows });
}

export async function deleteBillingUserData(context: ModuleContext, userId: string): Promise<Ok<undefined>> {
  if (!isUserId(userId)) return ok();
  const db = context.db as Queryable;
  // Lock the account first, in the order `changeEntitlement` takes its locks (account, then
  // entitlement): a change running at the same time then waits instead of deadlocking the erase.
  await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
  await db.delete(entitlements).where(eq(entitlements.userId, userId));
  await db.delete(payments).where(eq(payments.userId, userId));
  return ok();
}

export const billingPrivacyContributor: PrivacyContributor = {
  exportUserData: exportBillingUserData,
  deleteUserData: deleteBillingUserData,
};
