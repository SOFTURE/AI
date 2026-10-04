// The billing part of a GDPR export and deletion (`@softure-ai/privacy`): the account's entitlement
// row, its provider payments, its invoice requests and the plans granted to it by hand. An account
// without an entitlement row has no stored entitlement (its trial is derived from the account). The
// provider keeps its own records of the payments. Which admin granted or revoked a plan is the
// admin's data, not the account's, and is left out of the export.
import { users } from "@softure-ai/auth";
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, eq } from "drizzle-orm";
import { entitlements, manualGrants, paymentRequests, payments } from "../schema.js";
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
  /** The total refunded so far, in the currency's minor unit. */
  readonly refundedAmount: number;
  /** What the payment granted: `period` (from, until) or `lifetime`; null when recorded before grants were. */
  readonly grantKind: "period" | "lifetime" | null;
  readonly grantedFrom: Date | null;
  readonly grantedUntil: Date | null;
}

/** One invoice request, as it appears in an export; the details are gone once it was closed. */
export interface BillingPaymentRequestData {
  readonly planId: string;
  readonly invoiceName: string | null;
  readonly invoiceTaxId: string | null;
  readonly invoiceAddress: string | null;
  /** The plan's price the request quoted, in the currency's minor unit; null before prices were recorded. */
  readonly amount: number | null;
  readonly currency: string | null;
  readonly status: "open" | "granted" | "dismissed" | "expired";
  readonly requestedAt: Date;
  readonly closedAt: Date | null;
}

/** One plan granted by hand, as it appears in an export. */
export interface BillingManualGrantData {
  readonly planId: string;
  readonly grantedAt: Date;
  readonly grantKind: "period" | "lifetime";
  readonly grantedFrom: Date | null;
  readonly grantedUntil: Date | null;
  readonly status: "active" | "revoked";
  readonly revokedAt: Date | null;
  /** What it was granted for, in the currency's minor unit; null before prices were recorded. */
  readonly amount: number | null;
  readonly currency: string | null;
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
  /** Oldest first. */
  readonly paymentRequests: readonly BillingPaymentRequestData[];
  /** Oldest first. */
  readonly manualGrants: readonly BillingManualGrantData[];
}

const EMPTY_USER_DATA: BillingUserData = { entitlement: null, payments: [], paymentRequests: [], manualGrants: [] };

export async function exportBillingUserData(context: ModuleContext, userId: string): Promise<Ok<BillingUserData>> {
  if (!isUserId(userId)) return ok(EMPTY_USER_DATA);
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
      refundedAmount: payments.refundedAmount,
      grantKind: payments.grantKind,
      grantedFrom: payments.grantedFrom,
      grantedUntil: payments.grantedUntil,
    })
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(asc(payments.paidAt), asc(payments.id));
  const requestRows = await db
    .select({
      planId: paymentRequests.planId,
      invoiceName: paymentRequests.invoiceName,
      invoiceTaxId: paymentRequests.invoiceTaxId,
      invoiceAddress: paymentRequests.invoiceAddress,
      amount: paymentRequests.amount,
      currency: paymentRequests.currency,
      status: paymentRequests.status,
      requestedAt: paymentRequests.requestedAt,
      closedAt: paymentRequests.closedAt,
    })
    .from(paymentRequests)
    .where(eq(paymentRequests.userId, userId))
    .orderBy(asc(paymentRequests.requestedAt), asc(paymentRequests.id));
  const grantRows = await db
    .select({
      planId: manualGrants.planId,
      grantedAt: manualGrants.grantedAt,
      grantKind: manualGrants.grantKind,
      grantedFrom: manualGrants.grantedFrom,
      grantedUntil: manualGrants.grantedUntil,
      status: manualGrants.status,
      revokedAt: manualGrants.revokedAt,
      amount: manualGrants.amount,
      currency: manualGrants.currency,
    })
    .from(manualGrants)
    .where(eq(manualGrants.userId, userId))
    .orderBy(asc(manualGrants.grantedAt), asc(manualGrants.id));
  return ok({ entitlement: row ?? null, payments: paymentRows, paymentRequests: requestRows, manualGrants: grantRows });
}

export async function deleteBillingUserData(context: ModuleContext, userId: string): Promise<Ok<undefined>> {
  if (!isUserId(userId)) return ok();
  const db = context.db as Queryable;
  // Lock the account first, in the order `changeEntitlement` takes its locks (account, then
  // entitlement): a change running at the same time then waits instead of deadlocking the erase.
  await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
  await db.delete(entitlements).where(eq(entitlements.userId, userId));
  await db.delete(payments).where(eq(payments.userId, userId));
  // Grants first: they reference the requests they answered.
  await db.delete(manualGrants).where(eq(manualGrants.userId, userId));
  await db.delete(paymentRequests).where(eq(paymentRequests.userId, userId));
  return ok();
}

export const billingPrivacyContributor: PrivacyContributor = {
  exportUserData: exportBillingUserData,
  deleteUserData: deleteBillingUserData,
};
